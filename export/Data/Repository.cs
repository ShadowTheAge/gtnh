using export;

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
        public Locale locale;
    }

    public class RecipeMetadata : IEquatable<RecipeMetadata>
    {
        public string key;
        public double value;

        public bool Equals(RecipeMetadata other)
        {
            if (ReferenceEquals(null, other)) return false;
            if (ReferenceEquals(this, other)) return true;
            return key == other.key && value == other.value;
        }

        public override bool Equals(object obj)
        {
            if (ReferenceEquals(null, obj)) return false;
            if (ReferenceEquals(this, obj)) return true;
            if (obj.GetType() != this.GetType()) return false;
            return Equals((RecipeMetadata)obj);
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(key, value);
        }

        public static bool operator ==(RecipeMetadata left, RecipeMetadata right)
        {
            return Equals(left, right);
        }

        public static bool operator !=(RecipeMetadata left, RecipeMetadata right)
        {
            return !Equals(left, right);
        }
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