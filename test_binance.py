#!/usr/bin/env python3
"""
Test Binance API connectivity directly
"""
import asyncio
import aiohttp

BINANCE_API_BASE = "https://api.binance.com/api/v3"

async def test_binance_directly():
    """Test Binance API directly"""
    try:
        async with aiohttp.ClientSession() as session:
            # Test get all tickers
            print("🔍 Testing Binance ticker/24hr endpoint...")
            async with session.get(f"{BINANCE_API_BASE}/ticker/24hr") as response:
                print(f"Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"Got {len(data)} tickers")
                    btc_ticker = None
                    for ticker in data:
                        if ticker['symbol'] == 'BTCUSDT':
                            btc_ticker = ticker
                            break
                    if btc_ticker:
                        print(f"BTCUSDT found: price={btc_ticker['lastPrice']}")
                    else:
                        print("BTCUSDT not found in tickers")
                else:
                    print(f"Error: {await response.text()}")
            
            # Test specific price endpoint
            print("\n🔍 Testing Binance price endpoint for BTCUSDT...")
            async with session.get(f"{BINANCE_API_BASE}/ticker/price", params={"symbol": "BTCUSDT"}) as response:
                print(f"Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"BTCUSDT price: {data}")
                else:
                    print(f"Error: {await response.text()}")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_binance_directly())