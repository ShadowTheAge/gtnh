using Source;

namespace export;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("Usage: export <path to nesql export directory> [--output <path>] [--skipIcons]");
            Console.WriteLine("  --output <path>    Specify the output path for the generated files (default: current directory)");
            Console.WriteLine("  --skipIcons        Skip the icon generation step (you can't change item ban list or similar, or the icon index will be wrong)");
            Console.WriteLine("  --previous <path>  Path to previous data.bin to get old/obsolete recipes from");
            return;
        }

        var path = args[0];
        var outputPath = ".";
        string previous = null;
        var skipIcons = false;

        for (var i = 1; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--output":
                    outputPath = args[++i];
                    break;
                case "--skipIcons":
                    skipIcons = true;
                    break;
                case "--previous":
                    previous = args[++i];
                    break;
                default:
                    throw new InvalidOperationException("Unknown command line arg "+args[i]);
            }
        }

        PackGenerator.Generate(path, outputPath, skipIcons, previous);
    }
}