import React from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  inventory: number;
}

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Ceramic Pour-Over Dripper', price: 34.0, inventory: 12 },
  { id: 'p2', name: 'Gooseneck Electric Kettle', price: 129.0, inventory: 5 },
  { id: 'p3', name: 'Precision Burr Grinder', price: 210.0, inventory: 8 },
  { id: 'p4', name: 'Natural Fiber Filter Pack (100ct)', price: 9.5, inventory: 40 },
];

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-8">
      <header className="max-w-6xl mx-auto mb-10 flex justify-between items-center border-b border-stone-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipment Catalog</h1>
          <p className="text-stone-500 text-sm mt-1">Direct from independent roasters & craft fabricators.</p>
        </div>
        <div className="text-sm font-mono text-stone-600">
          Cart ({0})
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {PRODUCTS.map((prod) => (
            <div key={prod.id} className="p-4 bg-white rounded-lg border border-stone-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="h-40 bg-stone-100 rounded mb-3 flex items-center justify-center text-xs text-stone-400">
                  Image Placeholder
                </div>
                <h3 className="font-medium text-stone-900 text-sm">{prod.name}</h3>
                <div className="text-sm font-semibold text-stone-700 mt-1">${prod.price.toFixed(2)}</div>
              </div>
              <button
                type="button"
                className="mt-4 w-full py-1.5 px-3 bg-stone-900 text-white rounded text-xs font-medium hover:bg-stone-800 transition"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
