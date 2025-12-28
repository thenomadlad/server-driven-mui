# Prototype 1: Single entity `Form` view

This first prototype tackles the simplest need - the ability to view a single entity.
We will create form elements and a submit butto to edit the entity as well.

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

For this we might be ok just creating a single /sdmui endpoint which provides a list of form elements to view:

```ts
interface Company { /* fields for company type as described above */ }
interface CompanyUpdateCommand { /* only fields */ employees: Person[] }

// for example, we might just derive the form fields from the interface

CompanyFormView = FormView.forType(Company).forUpdateCommand(CompanyUpdateCommand)

// get entity to view/edit

const company = db.get_company(id)

// view object has details of what to show - forms for eacn field etc.

return new CompanyFormView(company)
```


## Implementation plan 

implement the logic in the sdmui framework to render a form with an input for each field and indentation for sub-fields

Also make sure that the form will only allow fields to be editable if they can be mapped to the PostRequest entity

## Playwright tests to consider

* simple flat form for simple flat entity like Address
* nested form entities and indentation for nested entitites like Address or Person in Company
* read-only data - let's make it so the email field cannot be edited for a person. Create a sdmui view for Person, and make sure the view is created with a `forUpdateCommand` type which doesn't have the email field and so indicates it cannot be modified


