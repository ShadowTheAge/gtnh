using Source;

namespace GT_recipe_parser
{
    public class RecipeTypeModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("CATEGORY")]
        public string Category { get; set; }

        [SchemaName("FLUID_INPUT_DIMENSION_HEIGHT")]
        public int FluidInputDimensionHeight { get; set; }

        [SchemaName("FLUID_INPUT_DIMENSION_WIDTH")]
        public int FluidInputDimensionWidth { get; set; }

        [SchemaName("FLUID_OUTPUT_DIMENSION_HEIGHT")]
        public int FluidOutputDimensionHeight { get; set; }

        [SchemaName("FLUID_OUTPUT_DIMENSION_WIDTH")]
        public int FluidOutputDimensionWidth { get; set; }

        [SchemaName("ICON_INFO")]
        public string IconInfo { get; set; }

        [SchemaName("ITEM_INPUT_DIMENSION_HEIGHT")]
        public int ItemInputDimensionHeight { get; set; }

        [SchemaName("ITEM_INPUT_DIMENSION_WIDTH")]
        public int ItemInputDimensionWidth { get; set; }

        [SchemaName("ITEM_OUTPUT_DIMENSION_HEIGHT")]
        public int ItemOutputDimensionHeight { get; set; }

        [SchemaName("ITEM_OUTPUT_DIMENSION_WIDTH")]
        public int ItemOutputDimensionWidth { get; set; }

        [SchemaName("SHAPELESS")]
        public bool Shapeless { get; set; }

        [SchemaName("TYPE")]
        public string Type { get; set; }
    }

    public class RecipeModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("RECIPE_TYPE_ID")]
        public string RecipeTypeId { get; set; }
    }

    public class GregTechRecipeModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("ADDITIONAL_INFO")]
        public string AdditionalInfo { get; set; }

        [SchemaName("AMPERAGE")]
        public int Amperage { get; set; }

        [SchemaName("DURATION")]
        public int Duration { get; set; }

        [SchemaName("REQUIRES_CLEANROOM")]
        public bool RequiresCleanroom { get; set; }

        [SchemaName("REQUIRES_LOW_GRAVITY")]
        public bool RequiresLowGravity { get; set; }

        [SchemaName("VOLTAGE")]
        public int Voltage { get; set; }

        [SchemaName("VOLTAGE_TIER")]
        public string VoltageTier { get; set; }

        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }
        
        [SchemaName("RECIPE_SPECIAL_VALUE")]
        public int RecipeSpecialValue { get; set; }
    }

    public class GregTechRecipeItemModel
    {
        [SchemaName("GREG_TECH_RECIPE_ID")]
        public string GregTechRecipeId { get; set; }

        [SchemaName("SPECIAL_ITEMS_ID")]
        public string SpecialItemsId { get; set; }
    }

    public class RecipeFluidGroupModel
    {
        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }

        [SchemaName("FLUID_INPUTS_ID")]
        public string FluidInputsId { get; set; }

        [SchemaName("FLUID_INPUTS_KEY")]
        public int FluidInputsKey { get; set; }
    }

    public class RecipeFluidInputsFluidsModel
    {
        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }

        [SchemaName("FLUID_INPUTS_FLUIDS_ID")]
        public string FluidInputsFluidsId { get; set; }
    }

    public class RecipeFluidOutputsModel
    {
        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }

        [SchemaName("FLUID_OUTPUTS_VALUE_AMOUNT")]
        public int FluidOutputsValueAmount { get; set; }

        [SchemaName("FLUID_OUTPUTS_VALUE_FLUID_ID")]
        public string FluidOutputsValueFluidId { get; set; }

        [SchemaName("FLUID_OUTPUTS_VALUE_PROBABILITY")]
        public double FluidOutputsValueProbability { get; set; }

        [SchemaName("FLUID_OUTPUTS_KEY")]
        public int FluidOutputsKey { get; set; }
    }

    public class RecipeItemGroupModel
    {
        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }

        [SchemaName("ITEM_INPUTS_ID")]
        public string ItemInputsId { get; set; }

        [SchemaName("ITEM_INPUTS_KEY")]
        public int ItemInputsKey { get; set; }
    }

    public class RecipeItemInputsItemsModel
    {
        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }

        [SchemaName("ITEM_INPUTS_ITEMS_ID")]
        public string ItemInputsItemsId { get; set; }
    }

    public class RecipeItemOutputsModel
    {
        [SchemaName("RECIPE_ID")]
        public string RecipeId { get; set; }

        [SchemaName("ITEM_OUTPUTS_VALUE_ITEM_ID")]
        public string ItemOutputsValueItemId { get; set; }

        [SchemaName("ITEM_OUTPUTS_VALUE_PROBABILITY")]
        public double ItemOutputsValueProbability { get; set; }

        [SchemaName("ITEM_OUTPUTS_VALUE_STACK_SIZE")]
        public int ItemOutputsValueStackSize { get; set; }

        [SchemaName("ITEM_OUTPUTS_KEY")]
        public int ItemOutputsKey { get; set; }
    }

    public class RecipeTypeItemModel
    {
        [SchemaName("RECIPE_TYPE_ID")]
        public string RecipeTypeId { get; set; }
        [SchemaName("ICON_ID")]
        public string IconId { get; set; }
    }
}