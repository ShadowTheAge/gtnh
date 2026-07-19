import { GetObjectName } from '../locale';
import { Repository, Item, Fluid, Recipe, OreDict } from '../repository';
import { setupRepository } from './setup';

describe('Repository', () => {
    beforeAll(async () => {
        await setupRepository();
    });

    it('should load repository data', () => {
        expect(Repository.current).toBeDefined();
    });

    it('should find items by id', () => {
        const item = Repository.current.GetById<Item>('i:gregtech:gt.blockmachines:1000');
        expect(item).toBeDefined();
        expect(GetObjectName(item!.id)).toBe('Electric Blast Furnace');
    });

    it('should find fluids by id', () => {
        const fluid = Repository.current.GetById<Fluid>('f:IC2:ic2steam');
        expect(fluid).toBeDefined();
        expect(GetObjectName(fluid!.id)).toBe('Steam');
    });
}); 