import React, { useState } from 'react';
import { Result, ZeroThrow, ZT } from '@zerothrow/core';
const { ok, err, ZeroError } = ZeroThrow;

// Example: Multi-step order processing with Result chaining
interface OrderData {
  items: Array<{ id: string; quantity: number }>;
  shipping: {
    address: string;
    method: 'standard' | 'express';
  };
  payment: {
    method: 'card' | 'paypal';
    token: string;
  };
}

interface Order {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
}

// Validation steps that return Results
const validateInventory = async (items: OrderData['items']): Promise<Result<OrderData['items'], ZeroError>> => {
  // Simulate inventory check
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // For testing, specific item IDs trigger out of stock
  const outOfStock = items.filter(item => 
    item.id === 'out-of-stock-item' || item.id === 'unavailable'
  );
  
  if (outOfStock.length > 0) {
    return err(new ZeroError(
      'INVENTORY_ERROR',
      'Some items are out of stock',
      { outOfStockItems: outOfStock }
    ));
  }
  
  return ok(items);
};

const calculateShipping = async (data: Pick<OrderData, 'items' | 'shipping'>): Promise<Result<number, ZeroError>> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const baseRate = data.shipping.method === 'express' ? 15 : 5;
  const weight = data.items.reduce((sum, item) => sum + (item.quantity * 0.5), 0);
  
  if (weight > 50) {
    return err(new ZeroError(
      'SHIPPING_ERROR',
      'Order too heavy for selected shipping method',
      { weight, maxWeight: 50 }
    ));
  }
  
  return ok(baseRate + (weight * 0.2));
};

const processPayment = async (amount: number, payment: OrderData['payment']): Promise<Result<string, ZeroError>> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // For testing, specific payment tokens trigger failures
  if (payment.token === 'declined' || payment.token === 'invalid-payment') {
    return err(new ZeroError(
      'PAYMENT_ERROR',
      'Payment declined',
      { amount, method: payment.method }
    ));
  }
  
  return ok(`txn_${Date.now()}`);
};

// Result chain helper - sequential processing with early termination on error
async function _chainResults<T>(
  operations: Array<() => Promise<Result<any, ZeroError>>>
): Promise<Result<T, ZeroError>> {
  let lastResult: any;
  
  for (const operation of operations) {
    const result = await operation();
    if (!result.ok) {
      return result;
    }
    lastResult = result.value;
  }
  
  return ok(lastResult);
}

// Main checkout component
export function CheckoutFlow() {
  const [orderData] = useState<OrderData>({
    items: [
      { id: 'prod1', quantity: 2 },
      { id: 'prod2', quantity: 1 }
    ],
    shipping: {
      address: '123 Main St',
      method: 'standard'
    },
    payment: {
      method: 'card',
      token: 'tok_test123'
    }
  });

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result<Order, ZeroError> | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  const processOrder = async () => {
    setProcessing(true);
    setResult(null);
    
    // Step 1: Validate inventory
    setCurrentStep('Checking inventory...');
    const inventoryResult = await validateInventory(orderData.items);
    
    if (!inventoryResult.ok) {
      setResult(err(inventoryResult.error));
      setProcessing(false);
      return;
    }

    // Step 2: Calculate shipping
    setCurrentStep('Calculating shipping...');
    const shippingResult = await calculateShipping({
      items: orderData.items,
      shipping: orderData.shipping
    });
    
    if (!shippingResult.ok) {
      setResult(err(shippingResult.error));
      setProcessing(false);
      return;
    }

    // Step 3: Calculate total
    const itemsTotal = orderData.items.reduce((sum, item) => sum + (item.quantity * 25), 0);
    const total = itemsTotal + shippingResult.value;

    // Step 4: Process payment
    setCurrentStep('Processing payment...');
    const paymentResult = await processPayment(total, orderData.payment);
    
    if (!paymentResult.ok) {
      setResult(err(paymentResult.error));
      setProcessing(false);
      return;
    }

    // Step 5: Create order
    setCurrentStep('Creating order...');
    const order: Order = {
      id: `ord_${Date.now()}`,
      status: 'completed',
      total
    };

    setResult(ok(order));
    setProcessing(false);
    setCurrentStep('');
  };

  // Alternative approach using ZT.try for the entire flow
  const processOrderWithZTTry = async () => {
    setProcessing(true);
    setResult(null);

    const orderResult = await ZT.try(async () => {
      setCurrentStep('Processing order...');
      
      // Validate
      const validItems = await validateInventory(orderData.items);
      if (!validItems.ok) throw validItems.error;

      // Calculate shipping
      const shipping = await calculateShipping({
        items: orderData.items,
        shipping: orderData.shipping
      });
      if (!shipping.ok) throw shipping.error;

      // Calculate total
      const itemsTotal = orderData.items.reduce((sum, item) => sum + (item.quantity * 25), 0);
      const total = itemsTotal + shipping.value;

      // Process payment
      const payment = await processPayment(total, orderData.payment);
      if (!payment.ok) throw payment.error;

      // Create order
      const order: Order = {
        id: `ord_${Date.now()}`,
        status: 'completed',
        total
      };

      return order;
    }, (error) => error instanceof ZeroError ? error : new ZeroError(
      'ORDER_ERROR',
      'Unexpected error during order processing',
      { cause: error }
    ));

    setResult(orderResult);
    setProcessing(false);
    setCurrentStep('');
  };

  return (
    <div className="checkout-flow">
      <h2>Checkout</h2>
      
      <div className="order-summary">
        <h3>Order Summary</h3>
        <ul>
          {orderData.items.map((item, idx) => (
            <li key={idx}>Product {item.id} × {item.quantity}</li>
          ))}
        </ul>
        <p>Shipping: {orderData.shipping.method}</p>
        <p>Payment: {orderData.payment.method}</p>
      </div>

      <div className="actions">
        <button 
          onClick={processOrder} 
          disabled={processing}
          className="btn-primary"
        >
          Process Order (Step by Step)
        </button>
        
        <button 
          onClick={processOrderWithZTTry} 
          disabled={processing}
          className="btn-secondary"
        >
          Process Order (With ZT.try)
        </button>
      </div>

      {processing && (
        <div className="processing">
          <div className="spinner" />
          <p>{currentStep}</p>
        </div>
      )}

      {result && (
        <div className={`result ${result.ok ? 'success' : 'error'}`}>
          {result.ok ? (
            <>
              <h3>Order Successful!</h3>
              <p>Order ID: {result.value.id}</p>
              <p>Total: ${result.value.total.toFixed(2)}</p>
              <p>Status: {result.value.status}</p>
            </>
          ) : (
            <>
              <h3>Order Failed</h3>
              <p>Error: {result.error.message}</p>
              <p>Code: {String(result.error.code)}</p>
              {result.error.context && (
                <pre>{JSON.stringify(result.error.context, null, 2)}</pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component showing Result utilities
export function ResultUtilities() {
  const examples = [
    {
      title: 'Basic Result Creation',
      code: `// Success
const success = ok({ id: 1, name: 'John' });

// Error
const error = err(new ZeroError('NOT_FOUND', 'User not found'));`
    },
    {
      title: 'Result Type Guards',
      code: `if (result.ok) {
  // TypeScript knows result.value exists
  console.log(result.value);
} else {
  // TypeScript knows result.error exists
  console.log(result.error);
}`
    },
    {
      title: 'Using ZT.try for Exception Handling',
      code: `const result = await ZT.try(
  async () => {
    const data = await fetchData();
    return processData(data);
  },
  (error) => new ZeroError('PROCESS_ERROR', 'Failed to process', { cause: error })
);`
    },
    {
      title: 'Wrapping Errors',
      code: `import { ZeroThrow } from '@zerothrow/core';
const { err } = ZeroThrow;

try {
  await riskyOperation();
} catch (error) {
  return err(ZeroThrow.wrap(error, 'OPERATION_FAILED', 'Risky operation failed'));
}`
    }
  ];

  return (
    <div className="result-utilities">
      <h2>ZeroThrow Result Utilities</h2>
      {examples.map((example, idx) => (
        <div key={idx} className="example">
          <h3>{example.title}</h3>
          <pre><code>{example.code}</code></pre>
        </div>
      ))}
    </div>
  );
}