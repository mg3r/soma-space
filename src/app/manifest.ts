import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'soma space',
    short_name: 'soma space',
    description: 'a movement gathering rooted in presence and free expression',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

