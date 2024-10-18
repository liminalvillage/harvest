declare module 'holosphere' {
    export default class HoloSphere {
        constructor(name: string);
        subscribe(holonID: string, node: string, callback: (item: any, key: string) => void): void;
        put(holonID: string, node: string, data: any): Promise<void>;
        delete(holonID: string, node: string, key: string): Promise<void>;
        get(holonID: string, node: string): Promise<any>;
    }
}
