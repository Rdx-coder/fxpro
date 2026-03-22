import aiohttp
from typing import List, Dict
import logging
import asyncio
import time
import random
import os

logger = logging.getLogger(__name__)

# Alpha Vantage API Configuration
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY")
ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query"
MARKET_LIST_LIVE_FETCH = os.getenv("MARKET_LIST_LIVE_FETCH", "false").lower() == "true"

# Trading symbols - Forex, Crypto, and Stocks
SYMBOLS_DATA = {
    # Major Forex Pairs
    "EUR/USD": {"type": "forex", "from": "EUR", "to": "USD", "name": "Euro/US Dollar", "basePrice": 1.0850},
    "GBP/USD": {"type": "forex", "from": "GBP", "to": "USD", "name": "British Pound/US Dollar", "basePrice": 1.2650},
    "USD/JPY": {"type": "forex", "from": "USD", "to": "JPY", "name": "US Dollar/Japanese Yen", "basePrice": 149.50},
    "USD/CHF": {"type": "forex", "from": "USD", "to": "CHF", "name": "US Dollar/Swiss Franc", "basePrice": 0.8850},
    "AUD/USD": {"type": "forex", "from": "AUD", "to": "USD", "name": "Australian Dollar/US Dollar", "basePrice": 0.6550},
    "USD/CAD": {"type": "forex", "from": "USD", "to": "CAD", "name": "US Dollar/Canadian Dollar", "basePrice": 1.3650},
    # Precious Metals
    "XAU/USD": {"type": "forex", "from": "XAU", "to": "USD", "name": "Gold/US Dollar", "basePrice": 2025.50},
    "XAG/USD": {"type": "forex", "from": "XAG", "to": "USD", "name": "Silver/US Dollar", "basePrice": 23.50},
    # Major Crypto
    "BTC/USD": {"type": "crypto", "symbol": "BTC", "name": "Bitcoin", "basePrice": 43500.00},
    "ETH/USD": {"type": "crypto", "symbol": "ETH", "name": "Ethereum", "basePrice": 2650.00},
    "BNB/USD": {"type": "crypto", "symbol": "BNB", "name": "Binance Coin", "basePrice": 315.00},
    "XRP/USD": {"type": "crypto", "symbol": "XRP", "name": "Ripple", "basePrice": 0.62},
    # Major US Stocks
    "AAPL": {"type": "stock", "symbol": "AAPL", "name": "Apple Inc.", "basePrice": 185.50},
    "GOOGL": {"type": "stock", "symbol": "GOOGL", "name": "Alphabet Inc.", "basePrice": 141.80},
    "MSFT": {"type": "stock", "symbol": "MSFT", "name": "Microsoft Corp.", "basePrice": 378.90},
    "TSLA": {"type": "stock", "symbol": "TSLA", "name": "Tesla Inc.", "basePrice": 248.50},
    "AMZN": {"type": "stock", "symbol": "AMZN", "name": "Amazon.com Inc.", "basePrice": 155.20},
    "META": {"type": "stock", "symbol": "META", "name": "Meta Platforms Inc.", "basePrice": 355.60},
    "NVDA": {"type": "stock", "symbol": "NVDA", "name": "NVIDIA Corp.", "basePrice": 495.80},
}

SYMBOLS = list(SYMBOLS_DATA.keys())

class CryptoClient:
    def __init__(self):
        self.session = None
        self.cache = {}
        self.cache_time = {}
        # Keep requests responsive: do not block API responses waiting for vendor limits.
        self.http_timeout = aiohttp.ClientTimeout(total=2.5)
        
    async def get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=self.http_timeout)
        return self.session

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()

    async def _fetch_forex_rate(self, from_currency: str, to_currency: str) -> Dict:
        """Fetch forex rate from Alpha Vantage"""
        if not ALPHA_VANTAGE_KEY:
            return None
        try:
            session = await self.get_session()
            url = ALPHA_VANTAGE_BASE
            params = {
                "function": "CURRENCY_EXCHANGE_RATE",
                "from_currency": from_currency,
                "to_currency": to_currency,
                "apikey": ALPHA_VANTAGE_KEY
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if "Realtime Currency Exchange Rate" in data:
                        rate_data = data["Realtime Currency Exchange Rate"]
                        price = float(rate_data["5. Exchange Rate"])
                        return {
                            "price": price,
                            "bid": float(rate_data.get("8. Bid Price", price)),
                            "ask": float(rate_data.get("9. Ask Price", price)),
                        }
                logger.error(f"Alpha Vantage forex error: {await response.text()}")
                return None
        except Exception as e:
            logger.error(f"Error fetching forex {from_currency}/{to_currency}: {str(e)}")
            return None

    async def _fetch_crypto_rate(self, symbol: str) -> Dict:
        """Fetch crypto rate from Alpha Vantage"""
        if not ALPHA_VANTAGE_KEY:
            return None
        try:
            session = await self.get_session()
            url = ALPHA_VANTAGE_BASE
            params = {
                "function": "CURRENCY_EXCHANGE_RATE",
                "from_currency": symbol,
                "to_currency": "USD",
                "apikey": ALPHA_VANTAGE_KEY
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if "Realtime Currency Exchange Rate" in data:
                        rate_data = data["Realtime Currency Exchange Rate"]
                        price = float(rate_data["5. Exchange Rate"])
                        return {"price": price}
                logger.error(f"Alpha Vantage crypto error: {await response.text()}")
                return None
        except Exception as e:
            logger.error(f"Error fetching crypto {symbol}: {str(e)}")
            return None

    async def _fetch_stock_quote(self, symbol: str) -> Dict:
        """Fetch stock quote from Alpha Vantage"""
        if not ALPHA_VANTAGE_KEY:
            return None
        try:
            session = await self.get_session()
            url = ALPHA_VANTAGE_BASE
            params = {
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": ALPHA_VANTAGE_KEY
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if "Global Quote" in data:
                        quote = data["Global Quote"]
                        if "05. price" in quote:
                            price = float(quote["05. price"])
                            return {
                                "price": price,
                                "change": float(quote.get("09. change", 0)),
                                "changePercent": float(quote.get("10. change percent", "0").replace("%", "")),
                            }
                logger.error(f"Alpha Vantage stock error: {await response.text()}")
                return None
        except Exception as e:
            logger.error(f"Error fetching stock {symbol}: {str(e)}")
            return None

    async def get_ticker_24h(self, symbol: str, use_live_fetch: bool = True) -> Dict:
        """Get ticker data for a symbol using vendor API with simulated fallback."""
        try:
            if symbol not in SYMBOLS_DATA:
                logger.error(f"Symbol {symbol} not supported")
                return None
            
            symbol_info = SYMBOLS_DATA[symbol]
            
            # Check cache (5 minute expiry)
            cache_key = f"ticker_{symbol}"
            if cache_key in self.cache:
                cache_age = time.time() - self.cache_time.get(cache_key, 0)
                if cache_age < 300:  # 5 minutes
                    return self.cache[cache_key]
            
            # For list endpoints we prioritize responsiveness over live fetch.
            rate_data = None
            if use_live_fetch:
                try:
                    if symbol_info["type"] == "forex":
                        rate_data = await self._fetch_forex_rate(symbol_info["from"], symbol_info["to"])
                    elif symbol_info["type"] == "crypto":
                        rate_data = await self._fetch_crypto_rate(symbol_info["symbol"])
                    elif symbol_info["type"] == "stock":
                        rate_data = await self._fetch_stock_quote(symbol_info["symbol"])
                except Exception as e:
                    logger.warning(f"API fetch failed for {symbol}, using fallback: {str(e)}")
                    rate_data = None
            
            # Use fallback/simulated data if API fails or returns None
            if not rate_data:
                rate_data = self._generate_simulated_data(symbol, symbol_info)
            
            price = rate_data["price"]
            
            # Calculate approximate 24h change
            if symbol_info["type"] == "stock" and "changePercent" in rate_data:
                change_percent = rate_data["changePercent"]
                change_24h = rate_data.get("change", price * (change_percent / 100))
            else:
                change_percent = rate_data.get("changePercent", random.uniform(-2, 2))
                change_24h = price * (change_percent / 100)
            
            ticker = {
                "symbol": symbol,
                "price": round(price, 4 if price < 10 else 2),
                "change24h": round(change_24h, 4 if abs(change_24h) < 1 else 2),
                "changePercent24h": round(change_percent, 2),
                "high24h": round(price * 1.015, 4 if price < 10 else 2),
                "low24h": round(price * 0.985, 4 if price < 10 else 2),
                "volume24h": round(random.uniform(1000000, 50000000), 2),
                "name": symbol_info.get("name", symbol)
            }
            
            # Cache the result
            self.cache[cache_key] = ticker
            self.cache_time[cache_key] = time.time()
            
            return ticker
            
        except Exception as e:
            logger.error(f"Error getting ticker for {symbol}: {str(e)}")
            # Return fallback data on any error
            return self._generate_fallback_ticker(symbol)
    
    def _generate_simulated_data(self, symbol: str, symbol_info: Dict) -> Dict:
        """Generate simulated price data based on base price with realistic variance"""
        base_price = symbol_info.get("basePrice", 100)
        # Add random variance of ±2%
        variance = random.uniform(-0.02, 0.02)
        price = base_price * (1 + variance)
        change_percent = random.uniform(-3, 3)
        return {
            "price": price,
            "changePercent": change_percent,
            "change": price * (change_percent / 100)
        }
    
    def _generate_fallback_ticker(self, symbol: str) -> Dict:
        """Generate fallback ticker when everything fails"""
        if symbol not in SYMBOLS_DATA:
            return None
        symbol_info = SYMBOLS_DATA[symbol]
        base_price = symbol_info.get("basePrice", 100)
        variance = random.uniform(-0.02, 0.02)
        price = base_price * (1 + variance)
        change_percent = random.uniform(-2, 2)
        return {
            "symbol": symbol,
            "price": round(price, 4 if price < 10 else 2),
            "change24h": round(price * (change_percent / 100), 4),
            "changePercent24h": round(change_percent, 2),
            "high24h": round(price * 1.015, 4 if price < 10 else 2),
            "low24h": round(price * 0.985, 4 if price < 10 else 2),
            "volume24h": round(random.uniform(1000000, 50000000), 2),
            "name": symbol_info.get("name", symbol)
        }

    async def get_all_tickers(self) -> List[Dict]:
        """Fast path for dashboard/list views: return cached/simulated values immediately."""
        tasks = [self.get_ticker_24h(symbol, use_live_fetch=MARKET_LIST_LIVE_FETCH) for symbol in SYMBOLS]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        tickers = []
        for result in results:
            if isinstance(result, Exception):
                continue
            if result:
                tickers.append(result)
        return tickers

    async def get_price(self, symbol: str) -> float:
        """Get current price for a symbol"""
        try:
            ticker = await self.get_ticker_24h(symbol)
            if ticker:
                return ticker["price"]
            return None
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {str(e)}")
            return None

# Create global client instance
binance_client = CryptoClient()  # Keep same name for compatibility
