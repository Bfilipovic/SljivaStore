import cluster from "cluster";
import os from "os";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get number of CPUs (or use env var if set)
const numWorkers = parseInt(process.env.CLUSTER_WORKERS || os.cpus().length.toString(), 10);

if (cluster.isPrimary) {
  console.log(`[Cluster] Master process ${process.pid} starting ${numWorkers} workers...`);

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork({ CLUSTER_WORKER_ID: i.toString() });
    console.log(`[Cluster] Forked worker ${i} (PID: ${worker.process.pid})`);
  }

  // Handle worker exit - restart it
  cluster.on("exit", (worker, code, signal) => {
    console.log(`[Cluster] Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
    cluster.fork();
  });

  // Log when workers come online
  cluster.on("online", (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Cluster] Master received SIGTERM, shutting down workers...");
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });
} else {
  // Worker process - import and start the server
  const workerId = process.env.CLUSTER_WORKER_ID || "unknown";
  console.log(`[Cluster] Worker ${workerId} (PID: ${process.pid}) starting...`);
  import("./server.js").catch((err) => {
    console.error(`[Cluster] Worker ${workerId} failed to start:`, err);
    process.exit(1);
  });
}

