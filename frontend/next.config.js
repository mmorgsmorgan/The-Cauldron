/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "*.ipfs.nftstorage.link" },
      { protocol: "https", hostname: "nftstorage.link" },
    ],
  },
};

module.exports = nextConfig;
