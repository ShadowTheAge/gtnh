using System.Security.Cryptography;
using System.Text;

namespace Source.Data
{
    public abstract class GoodsOrDict : IndexableObject;
    
    [Serializable]
    public class OreDict : GoodsOrDict
    {
        [NonSerialized] public string iid;
        public Item[] variants;
        public void GenerateId(Repository repository)
        {
            if (!string.IsNullOrEmpty(id))
                id = "o:" + id;
            else
            {
                var variant = variants[0];
                if (variants.All(x => x.mod == variant.mod && x.internalName == variant.internalName) && repository.items.Count(x => x.mod == variant.mod && x.internalName == variant.internalName) == variants.Length)
                    id = "o:" + variant.mod + ":" + variant.internalName;
                else id = "o:" + iid;
            }
        }
    }
    
    public abstract class Goods : GoodsOrDict
    {
        public string name;
        public string mod;
        public string internalName;
        public int numericId;
        public int iconId;
        public List<string> tooltipParts = new List<string>();
        public string unlocalizedName;
        public string nbt;
        public int[] production = Array.Empty<int>();
        public int[] consumption = Array.Empty<int>();
        public string tooltip => string.Join('\n', tooltipParts);
    }

    [Serializable]
    public struct ItemAspect
    {
        public string name;
        public int amount;
    }

    [Serializable]
    public class Item : Goods
    {
        public FluidContainer container;
        public int stackSize;
        public int damage;
        [NonSerialized] public bool touched;
        public List<ItemAspect> aspects = new List<ItemAspect>();
        public void GenerateId()
        {
            id = "i:" + mod + ":" + internalName + ":" + damage;
            if (!string.IsNullOrEmpty(nbt))
            {
                var bytes = Encoding.UTF8.GetBytes(nbt);
                using var sha = SHA1.Create();
                var hashBytes = sha.ComputeHash(bytes);
                id += ":" + string.Join("", hashBytes.Select(x => x.ToString("x2")));
            }
        }
    }

    [Serializable]
    public class FluidContainer
    {
        public Fluid fluid;
        public int amount;
        public Item empty;
    }

    [Serializable]
    public class Fluid : Goods
    {
        public bool isGas;
        public int[] containers = Array.Empty<int>();
        public void GenerateId()
        {
            id = "f:" + mod + ":" + internalName;
        }
    }
}