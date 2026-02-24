export interface Camera {
    id: string;
    name: string;
    rtspUrl: string;
    location: string | null;
    status: string;
    createdAt: string;
}

export interface Alert {
    id: string;
    message: string;
    cameraId: string;
    imageUrl: string | null;
    createdAt: string;
}