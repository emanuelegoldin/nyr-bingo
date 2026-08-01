# i18n App Routing

Starting from Next.Js 15, page params are promises

```ts
export default async function Page(props: {
  params: Promise<{ lang: Locale }>;
}) {
    const { lang } = await props.params;
    // ...
}
```

## Implicitly has any type

string can't be used to index dictionaries; that's why we need to coelasce it to a keyof with the following in accessing the proper locale:

```ts
type Locale = keyof typeof dicitonaries;

export function isLocale(locale: string): locale is Locale {
  return Object.keys(dicitonaries).includes(locale);
}
```

## Use Server != Server Only

'use-server' --> exported funciton shall ba async!

## Pass Translations to Client Component

We split most of the pages into a server-side component and a client-side component. In most cases we have a "shell" as a wrapper and then the concrete TSX component defined in a separate file.

In the `page.tsx` (**Server Component**) we can get the dicitonary based on the locale we set in the cookies.

From the dicitonary we can extract the needed string and pass them down to the client components that need it.

### Example - Dashboard Card

Users can change the language throuhgh a dropdown in the sidebar.

In the Dashboard Page (`app/(app)/dashboard/page.tsx`) we get the dicitonary based on the locale set by the user and pass relevant strings as porps to the client component:

```ts
async function DashboardTeamCardStream({/*...*/}) {
  const t = (await getDictionary()).Dashboard;  // Get dictionary here
  
  {/*...*/}
    
    return (
      <DashboardTeamCardClient
        team={team}
        currentUserId={currentUserId}
        initialCard={card}
        // Pass translation strings to client components
        dashboardText={{
          cardTitle: t.cardTitle,
          headerDescription: t.headerDescription,
        }}
      />
    );
  {/*...*/}
}
```

in DashboardTeamCardClient (`src/components/dashboard/dashboard-team-card-client.tsx`) we can then use the localized text

```ts
"use client";   // Client Component

{/*...*/}

export default function DashboardTeamCardClient({
  ...,
  dashboardText,  // get text through props from server component
}: DashboardTeamCardClientProps) {
  {/*...*/}
}
```

## Resources

- [GitHub | Internationalized Routing](https://github.com/vercel/next.js/tree/canary/examples/i18n-routing) (last accessed 21.07.2026)
- [From Midde´leware to Proxy](https://nextjs.org/docs/messages/middleware-to-proxy) (last accessed 21.07.2026)