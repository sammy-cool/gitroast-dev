import BattlePageClient from './BattlePageClient'

export async function generateMetadata({ params }) {
    const resolvedParams = await params

    const slug = Array.isArray(resolvedParams?.slug)
        ? resolvedParams.slug
        : []

    const joined = slug.join('/')
    const [user1 = 'unknown', user2 = 'unknown'] = joined.split('/vs/')

    return {
        title: `⚔️ ${user1} vs ${user2} — GitRoast Battle`,
        description: `Who codes worse? ${user1} vs ${user2} — GitRoast Battle`,
        openGraph: {
            title: `⚔️ ${user1} vs ${user2} — GitRoast Battle`,
            description: `Who codes worse? Find out at gitroast.dev`,
        },
    }
}

export default async function BattleSlugPage({ params }) {
    const resolvedParams = await params

    const slug = Array.isArray(resolvedParams?.slug)
        ? resolvedParams.slug
        : []

    const joined = slug.join('/')
    const [user1 = 'unknown', user2 = 'unknown'] = joined.split('/vs/')

    if (!user1 || !user2) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="font-mono" style={{ color: 'var(--bad)' }}>
                    Invalid battle URL. Go back and try again.
                </p>
            </div>
        )
    }

    return <BattlePageClient user1={user1} user2={user2} />
}
