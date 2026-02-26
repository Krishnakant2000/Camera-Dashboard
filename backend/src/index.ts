import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { prisma } from './db'
import { createNodeWebSocket } from '@hono/node-ws'
import { jwt, sign } from 'hono/jwt'
import bcrypt from 'bcryptjs'

const app = new Hono()

const JWT_SECRET = process.env.JWT_SECRET as string;

// Initialize WebSocket helper for Node.js
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// 1. Enable CORS (So our React Frontend can talk to this later)
app.use('/*', cors())

// 2. Health Check
app.get('/', (c) => {
    return c.text('Camera Dashboard API is Running! 🚀')
})

// Global variable to store connected WebSocket clients
// Think of this as a list of phone numbers we need to text when an alert happens
const connectedClients = new Set<any>();

// --- WEBSOCKET ROUTE (Real-time) ---
app.get('/ws', upgradeWebSocket((c) => {
    return {
        onOpen(event, ws) {
            console.log('Frontend connected to real-time stream!')
            connectedClients.add(ws)
        },
        onClose(event, ws) {
            console.log('Frontend disconnected')
            connectedClients.delete(ws)
        },
        onMessage(event, ws) {
            console.log('Message from frontend:', event.data)
        }
    }
}))

// --- AUTH ROUTES ---

// Register a new admin (You'll only use this once to create your account)
app.post('/auth/register', async (c) => {
    const { username, password } = await c.req.json()

    // Hash the password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    try {
        const user = await prisma.user.create({
            data: { username, password: hashedPassword }
        })
        return c.json({ message: 'User created successfully' }, 201)
    } catch (error) {
        return c.json({ error: 'Username might already exist' }, 400)
    }
})

// Login to get the JWT Token
app.post('/auth/login', async (c) => {
    const { username, password } = await c.req.json()

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return c.json({ error: 'Invalid credentials' }, 401)

    // Compare passwords
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) return c.json({ error: 'Invalid credentials' }, 401)

    // Generate the Token badge
    const payload = {
        id: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
    }
    const token = await sign(payload, JWT_SECRET)

    return c.json({ token })
})

// --- INTERNAL WORKER ROUTE ---
// The Go Worker calls this. (In a real app, this will be protected with a static API_KEY header!)
app.get('/worker/cameras', async (c) => {
    try {
        const cameras = await prisma.camera.findMany()
        return c.json(cameras)
    } catch (e) {
        return c.json({ error: 'Failed to fetch' }, 500)
    }
})

// --- PROTECT THE API ---
// This middleware acts as a bouncer. Any route below this line REQUIRES a valid JWT token.
app.use('/cameras/*', jwt({
    secret: JWT_SECRET,
    alg: 'HS256'
}))

// --- CAMERA ROUTES ---

// GET /cameras - List all cameras
app.get('/cameras', async (c) => {
    try {
        const cameras = await prisma.camera.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return c.json(cameras)
    } catch (e) {
        console.error("DATABASE ERROR:", e)
        return c.json({ error: 'Failed to fetch cameras' }, 500)
    }
})

// POST /cameras - Add a new camera
app.post('/cameras', async (c) => {
    try {
        const body = await c.req.json()
        // Basic validation
        if (!body.name || !body.rtspUrl) {
            return c.json({ error: 'Name and RTSP URL are required' }, 400)
        }

        const newCamera = await prisma.camera.create({
            data: {
                name: body.name,
                rtspUrl: body.rtspUrl,
                location: body.location || 'Unknown',
                status: 'active'
            }
        })
        return c.json(newCamera, 201)
    } catch (e) {
        console.error(e)
        return c.json({ error: 'Failed to create camera' }, 500)
    }
})

// DELETE: Remove a camera
app.delete('/cameras/:id', async (c) => {
    const id = c.req.param('id')
    await prisma.camera.delete({ where: { id } })
    return c.json({ success: true })
})

// PATCH: Update a camera's settings (Toggle AI or Status)
app.patch('/cameras/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()

    try {
        const updatedCamera = await prisma.camera.update({
            where: { id },
            data: {
                // Only update the fields that were actually sent in the request
                ...(body.status !== undefined && { status: body.status }),
                ...(body.aiEnabled !== undefined && { aiEnabled: body.aiEnabled })
            }
        })
        return c.json(updatedCamera)
    } catch (e) {
        console.error("Failed to update camera:", e)
        return c.json({ error: 'Failed to update' }, 500)
    }
})

// --- ALERT ROUTE (Called by Go Worker) ---
app.post('/alerts', async (c) => {
    const body = await c.req.json()

    // 1. Save alert to DB
    const alert = await prisma.alert.create({
        data: {
            message: body.message,
            cameraId: body.cameraId,
            imageUrl: body.imageUrl
        }
    })

    // 2. Broadcast to all connected Frontends immediately!
    const alertJson = JSON.stringify(alert)
    for (const client of connectedClients) {
        client.send(alertJson)
    }

    return c.json({ success: true })
})

// 3. Start the Server
const port = 3000
console.log(`Server is running on port ${port}`)

const server = serve({
    fetch: app.fetch,
    port
})

injectWebSocket(server)