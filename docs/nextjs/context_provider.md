
## Provide the Context value

Set the context value and provide it

```ts
const [title, setTitle] = useState(defaultTitle);
const [language, setLanguage] = useState<Locale>("en");
const value = useMemo(() => ({ title, setTitle, language, setLanguage }), [title, language]);   // Avoid re-rendering too many times with new context created every time
return (
    <AppContext.Provider value={value}> // set the value
      {children}
    </AppContext.Provider>
  );
```

create hook for other components:

```ts
// Can use useCOntext directly for simple cases
export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error(
      "useAppContext must be used within AppHeaderTitleProvider"
    );
  }
  return context;
}
```

```ts
// For compoents defined under the context provider
async function DashboardCardError({ gameName }: { gameName: string }) {
  const { language } = useAppContext();
  // ...
}
```

## Server component

Server components can not use the client hooks (e.g., useContext)

Hotfix: use cookie as bridge; set the cookie "locale" through the context and retrieve it on the server side through cookiesS