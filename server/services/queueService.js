const { logger } = require("../utils/logger");

class JobQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  enqueue(taskName, taskFn, options = {}) {
    const { maxRetries = 2, delayMs = 0 } = options;
    this.queue.push({
      taskName,
      taskFn,
      maxRetries,
      delayMs,
      retries: 0,
      enqueuedAt: Date.now(),
    });
    this.processNext();
  }

  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    this.running++;

    if (job.delayMs > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, job.delayMs);
        timer.unref();
      });
    }

    try {
      await job.taskFn();
      logger.debug("Queue", `Job completed: ${job.taskName}`, {
        durationMs: Date.now() - job.enqueuedAt,
      });
    } catch (err) {
      if (job.retries < job.maxRetries) {
        job.retries++;
        job.delayMs = Math.pow(2, job.retries) * 1000;
        logger.warn("Queue", `Job failed, retrying (${job.retries}/${job.maxRetries}): ${job.taskName}`, {
          error: err.message,
        });
        this.queue.push(job);
      } else {
        logger.error("Queue", `Job exhausted retries: ${job.taskName}`, {
          error: err.message,
        });
      }
    } finally {
      this.running--;
      this.processNext();
    }
  }

  getStats() {
    return {
      pending: this.queue.length,
      running: this.running,
      concurrency: this.concurrency,
    };
  }
}

const defaultQueue = new JobQueue(3);

module.exports = {
  JobQueue,
  defaultQueue,
  enqueue: (name, fn, opts) => defaultQueue.enqueue(name, fn, opts),
};
