import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const IDS_URL = process.env.IDS_URL || 'http://localhost:3001';
console.log('IDS_URL:', IDS_URL);

// Create an Express application
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// Create an HTTP server and attach the Express app
const httpServer = createServer(app);

// Create a Socket.IO server and attach it to the HTTP server
const io = new Server(httpServer, {
    cors: {
        origin: IDS_URL, // Adjust this as needed for security in production
    },
});

// Listen for client connections
io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);

    // Listen for any events and broadcast them
    socket.onAny((event, ...args) => {
        console.log(`Received event: ${event} with args:`, args);
        io.emit(event, ...args); // Broadcast the event to all connected clients
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('A client disconnected:', socket.id);
    });
});

// Define the API route
app.post('/api/vatis/flow', async (req, res) => {
    try {
        const response = await fetch(`${IDS_URL}/api/vatis/flow`, {
            cache: 'no-store',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });

        if (response.ok) {
            const data = await response.json();
            if (data !== false) {
                io.emit(`${data.facilityId}-flow`, data.runways); // Emit an event to all connected clients
                io.emit(`${data.facilityId}-atis`, req.body);
            }
        }

        res.status(200).send();
    } catch (error) {
        console.error('Error forwarding data:', error);
        res.status(500).json({ message: 'Error forwarding data', error });
    }
});

// Function to ping the VATSIM API
const pingVatsimApi = async () => {
    try {
        const response = await fetch('https://data.vatsim.net/v3/vatsim-data.json');
        if (response.ok) {
            const data = await response.json();

            // Emit the data to all connected clients if needed
            io.emit('vatsim-data', data);
        } else {
            console.error('Error fetching VATSIM API data:', response.statusText);
        }
    } catch (error) {
        console.error('Error pinging VATSIM API:', error);
    }
};

// Ping the VATSIM API every 15 seconds
setInterval(pingVatsimApi, 15000);

// Start the server on port 3000 (or any port you prefer)
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
    console.log(`Socket.IO server is running on port ${PORT}`);
});