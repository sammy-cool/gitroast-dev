import { Suspense } from 'react'
import RoastPageClient from './RoastPageClient'

export async function generateMetadata({ params }) {
    const { username } = await params

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const ogImageUrl = `${siteUrl}/api/og?username=${encodeURIComponent(username)}`

    return {
        title: `Get @${username} Roasted — GitRoast 🔥`,
        description: `See @${username}'s GitHub brutally roasted. Score, grade, and a savage roast. Can you do worse?`,

        openGraph: {
            title: `@${username}'s GitHub got roasted 🔥`,
            description: `See the score, grade, and roast. Then get roasted yourself.`,
            type: 'website',
            url: `${siteUrl}/roast/${username}`,
            images: [{
                url: ogImageUrl,
                width: 1200,
                height: 630,
                alt: `@${username}'s GitRoast score card`,
            }],
        },

        twitter: {
            card: 'summary_large_image',
            title: `@${username}'s GitHub got roasted 🔥`,
            description: `See the damage. Then get roasted yourself.`,
            images: [ogImageUrl],
        },
    }
}

export default async function RoastPage({ params }) {
    const { username } = await params

    return (
        <Suspense fallback={null}>
            <RoastPageClient username={username} />
        </Suspense>
    )
}
