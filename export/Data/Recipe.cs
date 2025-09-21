namespace Source.Data
{
    [Serializable]
    public class Recipe : IndexableObject
    {
        public RecipeType recipeType;
        public RecipeInput<Item>[] itemInputs;
        public RecipeInput<OreDict>[] oreDictInputs;
        public RecipeInput<Fluid>[] fluidInputs;
        public RecipeProduct<Item>[] itemOutputs;
        public RecipeProduct<Fluid>[] fluidOutputs;
        public GtRecipeInfo gtInfo;
    }
    
    [Serializable]
    public class GtRecipeInfo
    {
        public int voltage;
        public int durationTicks;
        public int amperage;
        public int voltageTier;
        public bool cleanRoom;
        public bool lowGravity;
        public string additionalInfo;
        public int circuitConflicts;
        public int specialValue;
    }
    
    [Serializable]
    public struct RecipeInput<T> where T:GoodsOrDict
    {
        public int slot;
        public int amount;
        public T goods;
    }
    
    [Serializable]
    public struct RecipeProduct<T> where T:Goods
    {
        public int slot;
        public int amount;
        public T goods;
        public float probability;
    }
}