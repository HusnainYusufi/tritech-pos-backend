'use strict';

module.exports = (Schema) => {
  const VariationIngredientSchema = new Schema({
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

  const RecipeVariantSchema = new Schema({
    recipeId: { type: Schema.Types.ObjectId, ref: 'Recipe', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '' },
    type: { type: String, enum: ['size', 'flavor', 'crust', 'style', 'custom'], default: 'custom' },

    sizeMultiplier: { type: Number, default: 1 }, // e.g., Large = 2, Medium = 1.5
    baseCostAdjustment: { type: Number, default: 0 }, // add/subtract base cost
    crustType: { type: String, trim: true, default: '' },

    ingredients: { type: [VariationIngredientSchema], default: [] },

    totalCost: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  RecipeVariantSchema.index({ recipeId: 1, name: 1 }, { unique: true });
  return RecipeVariantSchema;
};
