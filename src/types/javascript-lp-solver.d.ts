declare global {
    interface Window {
        solver: {
            Solve: (model: Model) => Solution;
        }
    }
}

export interface Model {
    optimize: string;
    opType: 'min' | 'max';
    constraints: {
        [key: string]: {
            min?: number;
            max?: number;
            equal?: number;
        };
    };
    variables: {
        [key: string]: {
            [key: string]: number;
        };
    };
}

export interface Solution {
    feasible: boolean;
    result: number;
    [key: string]: number | boolean;
} 