'use strict';

module.exports = (Schema) => {
  const IngredientSchema = new Schema({
    sourceType: {
      type: String,
      enum: ['inventory', 'recipe'],
      required: true,
      trim: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    nameSnapshot: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    costPerUnit: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
  });

  const RecipeSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    customName: { type: String, trim: true, default: '' },
    slug: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['sub', 'final'], default: 'final' },

    ingredients: { type: [IngredientSchema], default: [] },

    totalCost: { type: Number, default: 0 },
    yield: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },

    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  RecipeSchema.index({ name: 1 });
  RecipeSchema.index({ slug: 1 }, { unique: true });

  return RecipeSchema;
};
