# Prototype 2: The `Table` and `TableRow` abstractions

This prototype tackles a common need - the ability to view large
numbers of entities. A common UI that is created for this use case is a table
in which each `<tr>` contains one entity each. In a traditional table, the data
in each `<tr>` is simply arranged in columns. However, we do not need to have
that constraint, we should be able to create custom view of an individual entity

## `/api/data` endpoints

For this prototype, let's pretend we are dealing with personal address data. This means we create APIs managing a few data entities:

* /api/address
    * Street address (string)
    * Optional second line (string | null)
    * State (enum - lets just start with CA, MA and NY)
    * zipcode (number within range 10000 and 99999)

* /api/person
    * Full name (String)
    * phone number (String)
    * address Address

* /api/company
    * Name (String)
    * address (Address)
    * employees (list of Person)
    * roles (map of string to Person)

## `/sdmui` endpoints

Let's take inspiration from the spring-boot-data library and represent data as paginated rows

```ts
interface Page<T> {
    readonly entities: List<T>;
    readonly totalEntities: number;

    readonly pageNumber: number;
    readonly pageSize: number;
    readonly totalPages: number;
    readonly nextPageUrl: URL?;
    readonly previousPageUrl: URL?;
}
```

This way,


## Implementation plan 

* render a basic table, without any editing capability

## Playwright tests to consider

- TODO: spec out the tests

