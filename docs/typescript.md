## Add XYZ Type to TSConfig

While initilizing the `database/` folder to handle execution of tests with Jest, we got the following error when trying to use process.env:

```
[...] add 'node' to the types field in your tsconfig
```

After installing the @types/node dev dependency.

The solution was to create a new tsconfig.json file with the following content (which allows to derive types for node during development):

```json
{
   "compilerOptions": {
       "types" : ["node"]
   }
}
```

## Include/Exclude
<!-- TODO: what do they do? -->