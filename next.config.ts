import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
output: 'export',
basePath: '/giftique',
images: {
unoptimized: true,
},
}

export default nextConfig
