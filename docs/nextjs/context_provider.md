
## Provide the Context value

Set the context value and provide it

```ts
const [title, setTitle] = useState(defaultTitle);
const value = useMemo(() => ({ title, setTitle }), [title]);   // Avoid re-rendering too many times with new context created every time
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
  const { title } = useAppContext();
  // ...
}
```

## Server component

Server components can not use the client hooks (e.g., useContext). For the language, use next-intl instead (see `i18n_app_routing.md`).
