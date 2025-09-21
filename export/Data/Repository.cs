namespace Source.Data
{
    public class Repository
    {
        public List<Item> items = new List<Item>();
        public List<Fluid> fluids = new List<Fluid>();
        public List<OreDict> oreDicts = new List<OreDict>();
        public List<RecipeType> recipeTypes = new List<RecipeType>();
        public List<Recipe> recipes = new List<Recipe>();
        public List<RecipeRemap> remaps = new List<RecipeRemap>();
    }

    public class RecipeRemap
    {
        public string from;
        public Recipe to;
    }

    public abstract class IndexableObject
    {
        public IndexBits indexBits;
        public string id;
    }

    public struct RecipeDimensions
    {
        public int x, y;

        public RecipeDimensions(int x, int y)
        {
            this.x = x;
            this.y = y;
        }
    }
    
    
    public class RecipeType
    {
        public string name;
        public string category;
        public RecipeDimensions itemInputs;
        public RecipeDimensions fluidInputs;
        public RecipeDimensions itemOutputs;
        public RecipeDimensions fluidOutputs;
        public bool shapeless;
        public Item defaultCrafter;
        public List<Item> crafters = new List<Item>();
        public List<Item> singleblocks = new List<Item>();
        public List<Item> multiblocks = new List<Item>();
    }
}