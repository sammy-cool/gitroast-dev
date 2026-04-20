import { Suspense } from 'react'
import RoastPageClient from './RoastPageClient'

export async function generateMetadata({ params }) {
    const { username } = await params

    return {
        title: `@${username}'s GitHub Roast 🔥 — GitRoast`,
        description: `See how brutally @${username}'s GitHub got roasted. Public repos, commit messages, README quality — all judged.`,
        openGraph: {
            title: `@${username} just got roasted on GitRoast 🔥`,
            description: `Commit messages, abandoned repos, and coding shame — all exposed.`,
            type: 'website',
            url: `https://gitroast.dev/roast/${username}`,
            images: [{
                url: `https://gitroast.dev/api/og?username=${username}`,
                width: 1200,
                height: 630,
                alt: `@${username}'s GitRoast card`,
            }],
        },
        twitter: {
            card: 'summary_large_image',
            title: `@${username} got roasted 🔥`,
            description: 'Get your GitHub brutally roasted on GitRoast.',
            images: [`https://gitroast.dev/api/og?username=${username}`],
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
