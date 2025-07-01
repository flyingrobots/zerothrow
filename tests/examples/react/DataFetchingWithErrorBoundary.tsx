import React, { Component, ReactNode, useEffect, useState } from 'react';
import { Result, ok, err, ZeroError } from '@flyingrobots/zerothrow';

// Error Boundary component that works with Result types
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ResultErrorBoundary extends Component<
  { children: ReactNode; fallback: (error: Error) => ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}

// Custom hook for data fetching with Result type
function useDataFetch<T>(url: string) {
  const [result, setResult] = useState<Result<T, ZeroError> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          setResult(err(new ZeroError(
            'HTTP_ERROR',
            `HTTP error! status: ${response.status}`,
            { status: response.status, url }
          )));
          return;
        }

        const data = await response.json();
        
        if (!cancelled) {
          setResult(ok(data));
        }
      } catch (error) {
        if (!cancelled) {
          setResult(err(new ZeroError(
            'FETCH_ERROR',
            'Failed to fetch data',
            { cause: error instanceof Error ? error : new Error(String(error)) }
          )));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { result, loading };
}

// Component that uses the data fetching hook
function ProductList() {
  const { result, loading } = useDataFetch<Product[]>('/api/products');

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!result) {
    return <div>No data available</div>;
  }

  // Using type guard pattern instead of match
  if (result.ok) {
    return (
      <div className="product-grid">
        {result.value.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    );
  } else {
    return (
      <ErrorDisplay 
        error={result.error} 
        retry={() => window.location.reload()} 
      />
    );
  }
}

// Individual product card component
function ProductCard({ product }: { product: Product }) {
  const [cartResult, setCartResult] = useState<Result<string, string> | null>(null);

  const addToCart = async () => {
    const result = await addProductToCart(product.id);
    setCartResult(result);
  };

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p className="price">${product.price.toFixed(2)}</p>
      <button onClick={addToCart}>Add to Cart</button>
      
      {cartResult && (
        cartResult.ok 
          ? <span className="success">✓ Added to cart</span>
          : <span className="error">Failed: {cartResult.error}</span>
      )}
    </div>
  );
}

// Error display component
function ErrorDisplay({ error, retry }: { error: ZeroError; retry: () => void }) {
  return (
    <div className="error-container">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      {error.code && <p className="error-code">Error code: {String(error.code)}</p>}
      <button onClick={retry}>Try Again</button>
    </div>
  );
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      <p>Loading products...</p>
    </div>
  );
}

// Main app component with error boundary
export function App() {
  return (
    <ResultErrorBoundary
      fallback={(error) => (
        <div className="app-error">
          <h1>Application Error</h1>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Application
          </button>
        </div>
      )}
    >
      <div className="app">
        <header>
          <h1>Product Store</h1>
        </header>
        <main>
          <ProductList />
        </main>
      </div>
    </ResultErrorBoundary>
  );
}

// Type definitions
interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

// Simulated API function
async function addProductToCart(productId: string): Promise<Result<string, string>> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (Math.random() > 0.8) {
    return err('Cart service temporarily unavailable');
  }
  
  return ok(`Product ${productId} added to cart`);
}