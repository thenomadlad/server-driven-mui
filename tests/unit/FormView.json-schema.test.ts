import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FormView } from '../../src/api/FormView';

describe('FormView with JSON Schema', () => {
  describe('Simple schema', () => {
    const PersonSchema = z.object({
      id: z.string(),
      fullName: z.string().describe('Full Name'),
      email: z.string().email().describe('Email Address'),
      age: z.number().int().min(0).describe('Age'),
    });

    type Person = z.infer<typeof PersonSchema>;

    const samplePerson: Person = {
      id: '1',
      fullName: 'John Doe',
      email: 'john@example.com',
      age: 30,
    };

    it('should store JSON Schema in spec', () => {
      const jsonSchema = zodToJsonSchema(PersonSchema);
      const formView = FormView.fromSchema(jsonSchema, 'Person Form').buildForEntity(samplePerson);

      const spec = formView.toSpec();

      expect(spec.title).toBe('Person Form');
      expect(spec.schema).toBeDefined();
      expect(spec.schema.type).toBe('object');
      expect(spec.schema.properties).toHaveProperty('id');
      expect(spec.schema.properties).toHaveProperty('fullName');
      expect(spec.schema.properties).toHaveProperty('email');
      expect(spec.schema.properties).toHaveProperty('age');
      expect(formView.entity).toEqual(samplePerson);
    });

    it('should handle update commands', () => {
      const UpdatePersonSchema = PersonSchema.pick({
        fullName: true,
        age: true,
      });

      const jsonSchema = zodToJsonSchema(PersonSchema);
      const updateSchema = zodToJsonSchema(UpdatePersonSchema);

      const formView = FormView.fromSchema(jsonSchema, 'Person Form')
        .forUpdateCommand(updateSchema)
        .buildForEntity(samplePerson);

      const spec = formView.toSpec();

      expect(spec.submit.allowFields).toEqual(['$.fullName', '$.age']);
    });

    it('should configure submit', () => {
      const jsonSchema = zodToJsonSchema(PersonSchema);

      const formView = FormView.fromSchema(jsonSchema, 'Person Form')
        .submit({
          method: 'PUT',
          url: '/api/person/1',
        })
        .buildForEntity(samplePerson);

      const spec = formView.toSpec();

      expect(spec.submit.method).toBe('PUT');
      expect(spec.submit.url).toBe('/api/person/1');
    });
  });

  describe('Nested schemas', () => {
    const AddressSchema = z.object({
      street: z.string().describe('Street'),
      city: z.string().describe('City'),
      zipcode: z.number().describe('Zip Code'),
      state: z.enum(['CA', 'NY', 'TX']).describe('State'),
    });

    const PersonWithAddressSchema = z.object({
      id: z.string(),
      fullName: z.string().describe('Full Name'),
      address: AddressSchema.describe('Address'),
    });

    type PersonWithAddress = z.infer<typeof PersonWithAddressSchema>;

    const samplePersonWithAddress: PersonWithAddress = {
      id: '1',
      fullName: 'Jane Doe',
      address: {
        street: '123 Main St',
        city: 'San Francisco',
        zipcode: 94102,
        state: 'CA',
      },
    };

    it('should handle nested objects', () => {
      const jsonSchema = zodToJsonSchema(PersonWithAddressSchema);
      const formView = FormView.fromSchema(jsonSchema, 'Person Form').buildForEntity(samplePersonWithAddress);

      const spec = formView.toSpec();

      expect(spec.schema.properties.address).toBeDefined();
      expect(spec.schema.properties.address.type).toBe('object');
      expect(spec.schema.properties.address.properties).toHaveProperty('street');
      expect(spec.schema.properties.address.properties).toHaveProperty('city');
      expect(spec.schema.properties.address.properties).toHaveProperty('zipcode');
      expect(spec.schema.properties.address.properties).toHaveProperty('state');
    });

    it('should support forUpdateCommand with nested schemas', () => {
      const UpdateSchema = PersonWithAddressSchema.pick({ fullName: true }).extend({
        address: AddressSchema.pick({ street: true, city: true }),
      });

      const jsonSchema = zodToJsonSchema(PersonWithAddressSchema);
      const updateSchema = zodToJsonSchema(UpdateSchema);

      const formView = FormView.fromSchema(jsonSchema, 'Person Form')
        .forUpdateCommand(updateSchema)
        .buildForEntity(samplePersonWithAddress);

      const spec = formView.toSpec();

      expect(spec.submit.allowFields).toEqual(['$.fullName', '$.address.street', '$.address.city']);
    });
  });

  describe('Builder reusability', () => {
    it('should allow building multiple FormViews from the same builder', () => {
      const PersonSchema = z.object({
        id: z.string(),
        name: z.string().describe('Name'),
        email: z.string().email().describe('Email'),
      });

      const jsonSchema = zodToJsonSchema(PersonSchema);
      const updateSchema = zodToJsonSchema(PersonSchema.pick({ name: true }));

      // Create a reusable builder
      const builder = FormView.fromSchema(jsonSchema, 'Person Form').forUpdateCommand(updateSchema);

      // Build forms for different entities
      const person1 = { id: '1', name: 'Alice', email: 'alice@example.com' };
      const person2 = { id: '2', name: 'Bob', email: 'bob@example.com' };

      const formView1 = builder.buildForEntity(person1);
      const formView2 = builder.buildForEntity(person2);

      const spec1 = formView1.toSpec();
      const spec2 = formView2.toSpec();

      // Both forms should have the same structure
      expect(spec1.title).toBe('Person Form');
      expect(spec2.title).toBe('Person Form');
      expect(spec1.schema).toEqual(spec2.schema);

      // But different entity data
      expect(formView1.entity).toEqual(person1);
      expect(formView2.entity).toEqual(person2);

      // Both should have the same update command
      expect(spec1.submit.allowFields).toEqual(['$.name']);
      expect(spec2.submit.allowFields).toEqual(['$.name']);
    });
  });

  describe('JSON serialization', () => {
    it('should serialize FormView to JSON', () => {
      const SimpleSchema = z.object({
        name: z.string().describe('Name'),
        age: z.number().describe('Age'),
      });

      const jsonSchema = zodToJsonSchema(SimpleSchema);

      const formView = FormView.fromSchema(jsonSchema, 'Test Form').buildForEntity({ name: 'John', age: 30 });

      const json = formView.toJSON();

      expect(json.spec.type).toBe('form');
      expect(json.spec.title).toBe('Test Form');
      expect(json.spec.schema).toBeDefined();
      expect(json.entity).toEqual({ name: 'John', age: 30 });
    });
  });
});

