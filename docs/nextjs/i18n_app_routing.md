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

## Resources

- [GitHub | Internationalized Routing](https://github.com/vercel/next.js/tree/canary/examples/i18n-routing) (last accessed 21.07.2026)
- [From Midde´leware to Proxy](https://nextjs.org/docs/messages/middleware-to-proxy) (last accessed 21.07.2026)