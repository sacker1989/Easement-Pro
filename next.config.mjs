/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Static generation defaults to one worker per core, which exhausts heap on
    // memory-constrained machines (observed: OutOfMemoryException at
    // "Generating static pages"). This app has 8 trivial routes — extra
    // parallelism buys nothing and costs a build failure.
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
