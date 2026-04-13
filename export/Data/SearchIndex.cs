namespace Source.Data
{
    [Serializable]
    public struct IndexBits
    {
        public ulong lower;
        public ulong upper;

        public void SetBit(int bit)
        {
            if (bit < 64)
                lower |= (1ul << bit);
            else upper |= (1ul << (bit - 64));
        }

        public static IndexBits operator |(IndexBits a, IndexBits b)
        {
            return new IndexBits { lower = a.lower | b.lower, upper = a.upper | b.upper };
        }

        public override string ToString()
        {
            return upper.ToString("x16") + lower.ToString("x16");
        }
    }
    
    public static class SearchIndex
    {
        private const int CharCount = 26 + 10;
        private const int CharOffset = 128 - CharCount;

        public static IndexBits GetIndexBits(List<string> list)
        {
            var bits = new IndexBits();
            foreach (var s in list)
                bits |= GetIndexBits(s);
            return bits;
        }
        public static IndexBits GetIndexBits(ReadOnlySpan<char> chars)
        {
            var bits = new IndexBits();
            int c1 = -1, c2 = -1;
            foreach (var c in chars)
            {
                int c0;
                if (c >= '0' && c <= '9')
                    c0 = c - '0';
                else if (c >= 'a' && c <= 'z')
                    c0 = c - 'a' + 10;
                else if (c >= 'A' && c <= 'Z')
                    c0 = c - 'A' + 10;
                else if (c >= '\u2080' && c <= '\u2089')
                    c0 = c - '\u2080';
                else
                {
                    c1 = -1;
                    c2 = -1;
                    continue;
                }

                bits.SetBit(c0 + CharOffset);
                if (c1 != -1)
                {
                    bits.SetBit((c1 * CharCount + c0) % CharOffset);
                    if (c2 != -1)
                        bits.SetBit(((c2 * CharCount + c1)*CharCount + c0) % CharOffset);
                }

                c2 = c1;
                c1 = c0;
            }

            return bits;
        }
    }
}