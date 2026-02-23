import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { prisma } from './db'
import { createNodeWebSocket } from '@hono/node-ws'

const app = new Hono()

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

// --- CAMERA ROUTES ---

// GET /cameras - List all cameras
app.get('/cameras', async (c) => {
    try {
        const cameras = await prisma.camera.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return c.json(cameras)
    } catch (e) {
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