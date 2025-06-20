"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  Database,
  LogOut,
  Copy,
  Check,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  X,
  Settings,
  Webhook,
  Save,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react"
import axios from "axios"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

// Sample data for token prices
interface NftBid {
  id: number
  nftAddress: string
  bidAmount: string // Decimal values are returned as strings in JSON
  bidder: string
  timestamp: string
}

interface TokenPrice {
  id: number
  tokenAddress: string
  platform: string
  price: string // Decimal values are returned as strings in JSON
  timestamp: string
}

interface NftPrice {
  id: number
  nftId: string
  price: string // Prisma Decimal as a string in JSON
  action: string
  platform?: string
  dateTime: string // DateTime as ISO string
  buyer?: string
  seller?: string
}

interface BorrowableToken {
  id: number
  nftId: string
  loanAmount: string // Prisma Decimal as a string
  lender: string
  borrower?: string
  status: string
  offerDate: string // DateTime as ISO string
  takenDate?: string
  dueDate?: string
}

interface Transaction {
  id: string
  hash: string
  from: string
  to: string
  value: string
  timestamp: string
  type: "in" | "out"
  status: "confirmed" | "pending"
  description?: string
  source?: string
  transactionType?: string
}

interface ApiResponse {
  nftBids: NftBid[]
  tokenPrices: TokenPrice[]
  nftPrices: NftPrice[]
  borrowableTokens: BorrowableToken[]
  transactions: Transaction[]
  userCategories: string[]
  userTypes?: string[] // Add this new field
}

// Webhook configuration interfaces
interface WebhookInfo {
  webhookID: string
  webhookURL: string
  transactionTypes: string[]
  accountAddresses: string[]
  categories: string[]
  status: string
}

// Available transaction types
const TRANSACTION_TYPES = [
  { id: "NFT_BID", label: "NFT Bid", category: "NFT Bids" },
  { id: "NFT_BID_CANCELLED", label: "NFT Bid Cancelled", category: "NFT Bids" },
  { id: "NFT_GLOBAL_BID", label: "NFT Global Bid", category: "NFT Bids" },
  { id: "NFT_GLOBAL_BID_CANCELLED", label: "NFT Global Bid Cancelled", category: "NFT Bids" },
  { id: "NFT_LISTING", label: "NFT Listing", category: "NFT Prices" },
  { id: "NFT_SALE", label: "NFT Sale", category: "NFT Prices" },
  { id: "NFT_AUCTION_CREATED", label: "NFT Auction Created", category: "NFT Prices" },
  { id: "NFT_AUCTION_UPDATED", label: "NFT Auction Updated", category: "NFT Prices" },
  { id: "OFFER_LOAN", label: "Offer Loan", category: "Borrowable Tokens" },
  { id: "TAKE_LOAN", label: "Take Loan", category: "Borrowable Tokens" },
  { id: "RESCIND_LOAN", label: "Rescind Loan", category: "Borrowable Tokens" },
  { id: "REPAY_LOAN", label: "Repay Loan", category: "Borrowable Tokens" },
  { id: "SWAP", label: "Swap", category: "Token Prices" },
  { id: "ADD_TO_POOL", label: "Add to Pool", category: "Token Prices" },
  { id: "REMOVE_FROM_POOL", label: "Remove from Pool", category: "Token Prices" },
]

// Format timestamp to a more readable format
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// Format time relative to now (e.g., "2 mins ago")
const formatRelativeTime = (timestamp: string) => {
  const now = new Date()
  const txTime = new Date(timestamp)
  const diffMs = now.getTime() - txTime.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)

  if (diffSecs < 60) return `${diffSecs} secs ago`
  if (diffMins < 60) return `${diffMins} mins ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  return `${Math.floor(diffHours / 24)} days ago`
}

// Truncate long addresses for display
const truncateAddress = (address: string) => {
  if (address === "unknown") return address
  if (address.length <= 12) return address
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}



const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tokenPrice, setTokenPrice] = useState<TokenPrice[]>([])
  const [nftBidsData, setNftBidsData] = useState<NftBid[]>([])
  const [nftPricesData, setNftPricesData] = useState<NftPrice[]>([])
  const [borrowableTokensData, setBorrowableTokensData] = useState<BorrowableToken[]>([])
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txSidebarOpen, setTxSidebarOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [userTypes, setUserTypes] = useState<string[]>([])

  // Add isLoading states for each data type after the existing state declarations
  const [isTokenPriceLoading, setIsTokenPriceLoading] = useState(false)
  const [isNftBidsLoading, setIsNftBidsLoading] = useState(false)
  const [isNftPricesLoading, setIsNftPricesLoading] = useState(false)
  const [isBorrowableTokensLoading, setIsBorrowableTokensLoading] = useState(false)

  // Webhook management state
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [isLoadingWebhookInfo, setIsLoadingWebhookInfo] = useState(false)
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [tokenAddresses, setTokenAddresses] = useState<string[]>([])
  const [newTokenAddress, setNewTokenAddress] = useState("")
  const [webhookUpdateSuccess, setWebhookUpdateSuccess] = useState(false)
  const [webhookError, setWebhookError] = useState<string | null>(null)
  const [realtimeStats, setRealtimeStats] = useState<{
    totalFilteredTypes: number
    userCategories: string[]
    lastUpdateTime: Date | null
  }>({
    totalFilteredTypes: 0,
    userCategories: [],
    lastUpdateTime: null
  })
  const [showAllWebhookData, setShowAllWebhookData] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 2000)
    })
  }

  function getUserTypesBySubtypes(categories: string[]) {
    const matchedSubtypes: string[] = []
  
    if (NFT_BIDS_SUBTYPES.some((sub) => categories.includes(sub))) {
      matchedSubtypes.push("NFT Bids ")
    }
    if (NFT_PRICES_SUBTYPES.some((sub) => categories.includes(sub))) {
      matchedSubtypes.push("NFT Prices")
    }
    if (BORROWABLE_TOKENS_SUBTYPES.some((sub) => categories.includes(sub))) {
      matchedSubtypes.push("Borrowable Tokens")
    }
    if (TOKEN_PRICES_SUBTYPES.some((sub) => categories.includes(sub))) {
      matchedSubtypes.push("Token Prices")
    }
  
    return matchedSubtypes
  }
  

  const refreshTransactions = async (showAll = false) => {
    setIsRefreshing(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        console.error("No authentication token found")
        return
      }

      const response = await axios.get(`${BACKEND_URL}/api/webhook/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          limit: 50,
          showAll: showAll.toString()
        }
      })

      const data = response.data as { 
        transactions: Transaction[], 
        userCategories: string[], 
        totalFilteredTypes: number,
        isFiltered: boolean,
        totalFound: number
      }
      
      setTransactions(data.transactions || [])
      setRealtimeStats({
        totalFilteredTypes: data.totalFilteredTypes || 0,
        userCategories: data.userCategories || [],
        lastUpdateTime: new Date()
      })
      
      // Enhanced logging for debugging
      console.log(`🔥 Real-time monitoring update:`, {
        configuredTypes: data.totalFilteredTypes,
        foundTransactions: data.transactions.length,
        isFiltered: data.isFiltered,
        totalInDb: data.totalFound,
        userCategories: data.userCategories,
        showingAll: showAll
      })
    } catch (error) {
      console.error("Error refreshing transactions:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Add these refresh functions after the refreshTransactions function
  const refreshTokenPrices = async () => {
    setIsTokenPriceLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        console.error("No authentication token found")
        return
      }

      const response = await axios.get<ApiResponse>(`${BACKEND_URL}/api/webhook/getdata`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setTokenPrice(response.data.tokenPrices)
    } catch (error) {
      console.error("Error refreshing token prices:", error)
    } finally {
      setIsTokenPriceLoading(false)
    }
  }

  const refreshNftBids = async () => {
    setIsNftBidsLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        console.error("No authentication token found")
        return
      }

      const response = await axios.get<ApiResponse>(`${BACKEND_URL}/api/webhook/getdata`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setNftBidsData(response.data.nftBids)
    } catch (error) {
      console.error("Error refreshing NFT bids:", error)
    } finally {
      setIsNftBidsLoading(false)
    }
  }

  const refreshNftPrices = async () => {
    setIsNftPricesLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        console.error("No authentication token found")
        return
      }

      const response = await axios.get<ApiResponse>(`${BACKEND_URL}/api/webhook/getdata`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setNftPricesData(response.data.nftPrices)
    } catch (error) {
      console.error("Error refreshing NFT prices:", error)
    } finally {
      setIsNftPricesLoading(false)
    }
  }

  const refreshBorrowableTokens = async () => {
    setIsBorrowableTokensLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        console.error("No authentication token found")
        return
      }

      const response = await axios.get<ApiResponse>(`${BACKEND_URL}/api/webhook/getdata`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setBorrowableTokensData(response.data.borrowableTokens)
    } catch (error) {
      console.error("Error refreshing borrowable tokens:", error)
    } finally {
      setIsBorrowableTokensLoading(false)
    }
  }

  // Webhook management functions
  const fetchWebhookInfo = async () => {
    setIsLoadingWebhookInfo(true)
    setWebhookError(null)
    
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setWebhookError("Authentication token not found")
        return
      }

      const response = await axios.get<WebhookInfo>(`${BACKEND_URL}/api/webhook/info`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setWebhookInfo(response.data)
      
      // Filter out invalid transaction types (like 'LOAN') before setting state
      const validTransactionTypes = TRANSACTION_TYPES.map(t => t.id)
      const filteredCategories = response.data.transactionTypes.filter(type => 
        validTransactionTypes.includes(type)
      )
      
      setSelectedCategories(filteredCategories)
      setTokenAddresses(response.data.accountAddresses)
    } catch (error: any) {
      console.error("Error fetching webhook info:", error)
      setWebhookError(error.response?.data?.error || "Failed to fetch webhook information")
    } finally {
      setIsLoadingWebhookInfo(false)
    }
  }

  const updateWebhook = async () => {
    if (selectedCategories.length === 0) {
      setWebhookError("Please select at least one transaction type")
      return
    }

    if (tokenAddresses.length === 0) {
      setWebhookError("Please add at least one token address")
      return
    }

    setIsUpdatingWebhook(true)
    setWebhookError(null)
    setWebhookUpdateSuccess(false)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setWebhookError("Authentication token not found")
        return
      }

      // Filter out any invalid transaction types before sending
      const validTransactionTypes = TRANSACTION_TYPES.map(t => t.id)
      const filteredCategories = selectedCategories.filter(type => 
        validTransactionTypes.includes(type)
      )

      console.log("Sending webhook update with filtered categories:", filteredCategories)

      await axios.put(`${BACKEND_URL}/api/webhook/update`, {
        categories: filteredCategories,
        tokenAddress: tokenAddresses
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setWebhookUpdateSuccess(true)
      setTimeout(() => setWebhookUpdateSuccess(false), 3000)
      
      // Refresh webhook info
      await fetchWebhookInfo()
    } catch (error: any) {
      console.error("Error updating webhook:", error)
      setWebhookError(error.response?.data?.error || "Failed to update webhook")
    } finally {
      setIsUpdatingWebhook(false)
    }
  }

  const addTokenAddress = () => {
    if (newTokenAddress.trim() && !tokenAddresses.includes(newTokenAddress.trim())) {
      setTokenAddresses([...tokenAddresses, newTokenAddress.trim()])
      setNewTokenAddress("")
    }
  }

  const removeTokenAddress = (address: string) => {
    setTokenAddresses(tokenAddresses.filter(addr => addr !== address))
  }

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, categoryId])
    } else {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId))
    }
  }

  useEffect(() => {
    const fetchTokenData = async () => {
      const token = localStorage.getItem("token")

      if (!token) {
        console.error("No authentication token found")
        return
      }

      try {
        const response = await axios.get(`${BACKEND_URL}/api/webhook/getdata`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        const { nftBids, tokenPrices, nftPrices, borrowableTokens, transactions = [], userCategories } = response.data as ApiResponse
        const userTypes = getUserTypesBySubtypes(userCategories)

        setCategories(userCategories)
        setUserTypes(userTypes)
        setNftPricesData(nftPrices)
        setBorrowableTokensData(borrowableTokens)
        setNftBidsData(nftBids)
        setTokenPrice(tokenPrices)
        setTransactions(transactions || [])
      } catch (error: unknown) {
        console.error("Error fetching data:", error)
      }
    }

    // Initial fetch
    fetchTokenData()
    
    // Also fetch the latest transactions immediately for real-time sidebar
    refreshTransactions()

    // Set up interval for real-time transaction updates
    const interval = setInterval(() => {
        refreshTransactions(showAllWebhookData)
    }, 5000) // Refresh every 5 seconds for more responsive real-time updates

    return () => clearInterval(interval)
  }, [])

  function hasCategory(userCategories: string[], subtypes: string[]) {
    return subtypes.some((subtype) => userCategories.includes(subtype))
  }

  const NFT_BIDS_SUBTYPES = ["NFT_BID", "NFT_BID_CANCELLED", "NFT_GLOBAL_BID", "NFT_GLOBAL_BID_CANCELLED"]
  const NFT_PRICES_SUBTYPES = ["NFT_LISTING", "NFT_SALE", "NFT_AUCTION_CREATED", "NFT_AUCTION_UPDATED"]
  const BORROWABLE_TOKENS_SUBTYPES = ["OFFER_LOAN", "RESCIND_LOAN", "TAKE_LOAN", "REPAY_LOAN"]
  const TOKEN_PRICES_SUBTYPES = ["SWAP", "ADD_TO_POOL", "REMOVE_FROM_POOL"]

  function getDefaultTab(userCategories: string[]) {
    if (hasCategory(userCategories, NFT_BIDS_SUBTYPES)) return "nft-bids"
    if (hasCategory(userCategories, NFT_PRICES_SUBTYPES)) return "nft-prices"
    if (hasCategory(userCategories, BORROWABLE_TOKENS_SUBTYPES)) return "borrowable-tokens"
    return "token-prices"
  }

  // Inside your Dashboard component:
  const defaultTab = getDefaultTab(categories)
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Calculate total data points
  const totalDataPoints = tokenPrice.length + nftBidsData.length + nftPricesData.length + borrowableTokensData.length

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-slate-200/40 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -z-10" />
      
      {/* Main Sidebar */}
      <div
        className={`bg-white/80 backdrop-blur-sm border-r border-blue-100/50 shadow-lg shadow-blue-100/25 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        } flex flex-col z-20`}
      >
        <div className="p-4 border-b border-blue-100/50 flex items-center justify-between">
          <div className={`flex items-center ${!sidebarOpen && "justify-center"}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-md">
              <Database className="h-4 w-4 text-white" />
          </div>
            {sidebarOpen && (
              <div className="ml-3">
                <span className="font-bold text-slate-800 bg-clip-text bg-gradient-to-r from-blue-900 to-purple-900">
                  Soldex
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  <span className="text-xs text-slate-600 font-medium">Pro</span>
                </div>
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-700"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${!sidebarOpen && "rotate-90"}`} />
          </Button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 space-y-2">
            <Button 
              variant="default" 
              className={`w-full justify-${sidebarOpen ? "start" : "center"} mb-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all duration-200`}
            >
              <Database className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 font-medium">Data Explorer</span>}
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-${sidebarOpen ? "start" : "center"} hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition-all duration-200`}
              onClick={() => setTxSidebarOpen(!txSidebarOpen)}
            >
              <Activity className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2 font-medium">Transactions</span>}
            </Button>
          </div>
        </nav>

        <div className="p-4 border-t border-blue-100/50">
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem("token")
              window.location.href = "/"
            }}
            className={`w-full justify-${sidebarOpen ? "start" : "center"} text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors`}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2 font-medium">Logout</span>}
          </Button>
        </div>
      </div>

      {/* Real-time Transactions Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full bg-white/95 backdrop-blur-sm border-l border-blue-200/50 shadow-2xl shadow-blue-200/25 transition-all duration-300 z-30 ${
          txSidebarOpen ? "translate-x-0 w-80" : "translate-x-full w-0"
        }`}
      >
        <div className="p-4 border-b border-blue-100/50 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-purple-50/50">
          <div className="flex items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-md">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="ml-3">
              <span className="font-bold text-slate-800">Real-time Transactions</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">Live</span>
                </div>
                {showAllWebhookData ? (
                  <div className="flex items-center gap-1">
                    <Database className="h-3 w-3 text-purple-500" />
                    <span className="text-xs text-purple-600 font-medium">ALL Data</span>
                  </div>
                ) : realtimeStats.totalFilteredTypes > 0 ? (
                  <div className="flex items-center gap-1">
                    <Settings className="h-3 w-3 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">
                      {realtimeStats.totalFilteredTypes} types
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showAllWebhookData ? "default" : "ghost"}
                    size="icon"
                    onClick={() => {
                      const newShowAll = !showAllWebhookData;
                      setShowAllWebhookData(newShowAll);
                      refreshTransactions(newShowAll);
                    }}
                    className="h-8 w-8 hover:bg-purple-50 hover:text-purple-700"
                  >
                    <Database className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showAllWebhookData ? "Show filtered transactions" : "Show ALL webhook data"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshTransactions(showAllWebhookData)}
              disabled={isRefreshing}
              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-700"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setTxSidebarOpen(false)} 
              className="h-8 w-8 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-85px)] p-4">
          <div className="space-y-3">
            {/* Show helpful messages when no transactions or filters */}
            {transactions.length === 0 && (
              <div className="text-center py-8">
                {realtimeStats.totalFilteredTypes === 0 ? (
                  <div className="bg-yellow-50/80 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-center justify-center mb-2">
                      <Settings className="h-6 w-6 text-yellow-600" />
                    </div>
                    <h3 className="font-medium text-yellow-800 mb-2">No Transaction Types Configured</h3>
                    <p className="text-sm text-yellow-700 mb-3">
                      Configure your webhook in the Settings tab to start monitoring specific transaction types.
                    </p>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      Go to Webhook Settings
                    </Badge>
                  </div>
                ) : (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-center mb-2">
                      <Activity className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="font-medium text-blue-800 mb-2">Waiting for Transactions</h3>
                    <p className="text-sm text-blue-700 mb-2">
                      Monitoring {realtimeStats.totalFilteredTypes} transaction type{realtimeStats.totalFilteredTypes !== 1 ? 's' : ''}
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      {realtimeStats.userCategories.slice(0, 3).map((category, idx) => (
                        <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 mr-1">
                          {category}
                        </Badge>
                      ))}
                      {realtimeStats.userCategories.length > 3 && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          +{realtimeStats.userCategories.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="bg-white/70 backdrop-blur-sm border border-blue-100/50 rounded-xl p-4 hover:bg-blue-50/30 hover:border-blue-200/50 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-blue-100/25"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      tx.type === "in" 
                        ? "bg-gradient-to-br from-green-500 to-emerald-600" 
                        : "bg-gradient-to-br from-red-500 to-rose-600"
                    } shadow-md`}>
                    {tx.type === "in" ? (
                        <ArrowDownRight className="h-4 w-4 text-white" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="ml-3">
                      <span className="text-sm font-semibold text-slate-800">
                        {tx.transactionType || tx.type.toUpperCase()}
                    </span>
                      <div className={`text-xs font-medium ${tx.type === "in" ? "text-green-600" : "text-red-600"}`}>
                        {tx.value} SOL
                  </div>
                    </div>
                  </div>
                  <Badge 
                    variant={tx.status === "confirmed" ? "outline" : "secondary"} 
                    className={`text-xs ${
                      tx.status === "confirmed" 
                        ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}
                  >
                    {tx.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Hash:</span>
                    <span className="font-mono text-slate-800 bg-white/60 px-2 py-1 rounded">{truncateAddress(tx.hash)}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">From:</span>
                    <span className="font-mono text-slate-800 bg-white/60 px-2 py-1 rounded">{truncateAddress(tx.from)}</span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">To:</span>
                    <span className="font-mono text-slate-800 bg-white/60 px-2 py-1 rounded">{truncateAddress(tx.to)}</span>
                  </div>

                  {tx.description && (
                    <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-2">
                      <span className="text-slate-600 font-medium">Description:</span>
                      <span className="text-xs truncate max-w-32 bg-white/60 px-2 py-1 rounded">{tx.description}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Time:</span>
                    <div className="flex items-center bg-white/60 px-2 py-1 rounded">
                      <Clock className="h-3 w-3 mr-1 text-blue-500" />
                      <span className="text-slate-800">{formatRelativeTime(tx.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-purple-900">
                  Soldex Data Explorer
                </h1>
                <p className="text-slate-600 mt-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  View and analyze indexed blockchain data in real-time
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-blue-100/50">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-slate-700">Live Updates</span>
                </div>
                <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 shadow-md">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Pro Active
                </Badge>
              </div>
            </div>
          </div>

          {/* Summary Cards - First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Data Points Card - Now larger and more prominent */}
            <Card className="md:col-span-2 bg-white/80 backdrop-blur-sm border-blue-100/50 shadow-lg shadow-blue-100/25 hover:shadow-blue-200/30 transition-all duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-t-lg">
                <div>
                  <CardTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-purple-900">
                    Data Points Overview
                  </CardTitle>
                  <CardDescription className="text-slate-600 flex items-center gap-1 mt-1">
                    <Database className="h-3 w-3 text-blue-600" />
                    Summary of all indexed blockchain data
                  </CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-md">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left side - Total count and breakdown */}
                  <div className="flex-1">
                    <div className="flex items-baseline mb-6">
                      <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mr-3">
                        {totalDataPoints}
                      </span>
                      <span className="text-slate-600 font-medium">total data points</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Token Prices:</span>
                          <span className="font-bold text-blue-600">{tokenPrice.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(tokenPrice.length / totalDataPoints) * 100 || 0}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">NFT Bids:</span>
                          <span className="font-bold text-purple-600">{nftBidsData.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(nftBidsData.length / totalDataPoints) * 100 || 0}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">NFT Prices:</span>
                          <span className="font-bold text-indigo-600">{nftPricesData.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(nftPricesData.length / totalDataPoints) * 100 || 0}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Borrowable:</span>
                          <span className="font-bold text-cyan-600">{borrowableTokensData.length}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(borrowableTokensData.length / totalDataPoints) * 100 || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side - User types and categories */}
                  <div className="flex-1 border-t md:border-t-0 md:border-l border-blue-100/50 pt-4 md:pt-0 md:pl-6">
                    <div className="mb-6">
                      <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-blue-600" />
                        User Types Indexed
                      </div>
                      <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-3">
                        {userTypes.length}
                      </div>
                      <div className="space-y-2 max-h-20 overflow-y-auto">
                        {userTypes.length > 0 ? (
                          userTypes.map((type, index) => (
                            <div key={index} className="flex items-center text-sm bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-blue-50">
                              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 mr-2"></span>
                              <span className="truncate font-medium text-slate-700">{type}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400 italic text-sm bg-slate-50/50 rounded-lg p-3 text-center">
                            No user types available
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Badge className="h-4 w-4 bg-purple-600" />
                        Categories
                      </div>
                      <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 mb-3">
                        {categories.length}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categories.slice(0, 5).map((category, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          >
                            {category}
                          </Badge>
                        ))}
                        {categories.length > 5 && (
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          >
                            +{categories.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Cards - Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="bg-white/80 backdrop-blur-sm border-blue-100/50 shadow-lg shadow-blue-100/25 hover:shadow-blue-200/30 transition-all duration-200">
              <CardHeader className="pb-2 bg-gradient-to-r from-blue-50/50 to-blue-100/50 rounded-t-lg">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                    <Database className="h-4 w-4 text-white" />
                  </div>
                  Total Tokens Indexed
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-700 mb-3">
                  {tokenPrice.length}
                  </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center bg-blue-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Unique Platforms:</span>
                    <span className="font-bold text-blue-600">{[...new Set(tokenPrice.map((t) => t.platform))].length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Latest Update:</span>
                    <span className="font-medium text-slate-700">
                      {tokenPrice.length > 0
                        ? formatRelativeTime(
                            tokenPrice.sort(
                              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                            )[0].timestamp,
                          )
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-purple-100/50 shadow-lg shadow-purple-100/25 hover:shadow-purple-200/30 transition-all duration-200">
              <CardHeader className="pb-2 bg-gradient-to-r from-purple-50/50 to-purple-100/50 rounded-t-lg">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-md">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  NFT Bids Indexed
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-700 mb-3">
                  {nftBidsData.length}
                  </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center bg-purple-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Unique NFTs:</span>
                    <span className="font-bold text-purple-600">{[...new Set(nftBidsData.map((b) => b.nftAddress))].length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-purple-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Unique Bidders:</span>
                    <span className="font-bold text-purple-600">{[...new Set(nftBidsData.map((b) => b.bidder))].length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-cyan-100/50 shadow-lg shadow-cyan-100/25 hover:shadow-cyan-200/30 transition-all duration-200">
              <CardHeader className="pb-2 bg-gradient-to-r from-cyan-50/50 to-cyan-100/50 rounded-t-lg">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-md">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  Borrowable Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-cyan-700 mb-3">
                  {borrowableTokensData.length}
                  </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center bg-cyan-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Active Loans:</span>
                    <span className="font-bold text-cyan-600">{borrowableTokensData.filter((t) => t.status === "ACTIVE").length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-cyan-50/50 rounded-lg p-2">
                    <span className="text-slate-600 font-medium">Unique Lenders:</span>
                    <span className="font-bold text-cyan-600">{[...new Set(borrowableTokensData.map((t) => t.lender))].length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="token-prices" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mb-6">
              <TabsList className="bg-white/80 backdrop-blur-sm border border-blue-100/50 shadow-lg shadow-blue-100/25 p-1 rounded-xl">
                {hasCategory(categories, NFT_BIDS_SUBTYPES) && (
                  <TabsTrigger 
                    value="nft-bids" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-purple-50 transition-all duration-200 font-medium"
                  >
                    NFT Bids
                  </TabsTrigger>
                )}
                {hasCategory(categories, NFT_PRICES_SUBTYPES) && (
                  <TabsTrigger 
                    value="nft-prices"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-indigo-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-indigo-50 transition-all duration-200 font-medium"
                  >
                    NFT Prices
                  </TabsTrigger>
                )}
                {hasCategory(categories, BORROWABLE_TOKENS_SUBTYPES) && (
                  <TabsTrigger 
                    value="borrowable-tokens"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-cyan-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-cyan-50 transition-all duration-200 font-medium"
                  >
                    Borrowable Tokens
                  </TabsTrigger>
                )}
                {hasCategory(categories, TOKEN_PRICES_SUBTYPES) && (
                  <TabsTrigger 
                    value="token-prices"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-blue-50 transition-all duration-200 font-medium"
                  >
                    Token Prices
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="webhook-settings"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50 transition-all duration-200 font-medium"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Webhook Settings
                </TabsTrigger>
              </TabsList>
            </div>

            {hasCategory(categories, TOKEN_PRICES_SUBTYPES) && (
              <TabsContent value="token-prices" className="mt-0">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Token Price Data</CardTitle>
                      <CardDescription>Real-time token prices from various platforms</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={refreshTokenPrices}
                      disabled={isTokenPriceLoading}
                      className="h-8 w-8"
                    >
                      <RefreshCw className={`h-4 w-4 ${isTokenPriceLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token Address</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Price (USD)</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tokenPrice.map((token, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(token.tokenAddress)}</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(token.tokenAddress)}
                                      >
                                        {copiedText === token.tokenAddress ? (
                                          <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {copiedText === token.tokenAddress ? "Copied!" : "Copy address"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{token.platform}</Badge>
                            </TableCell>
                            <TableCell>${token.price}</TableCell>
                            <TableCell>{formatTimestamp(token.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {hasCategory(categories, NFT_BIDS_SUBTYPES) && (
              <TabsContent value="nft-bids" className="mt-0">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>NFT Bids</CardTitle>
                      <CardDescription>Recent bids on Magic Eden NFT bids</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={refreshNftBids}
                      disabled={isNftBidsLoading}
                      className="h-8 w-8"
                    >
                      <RefreshCw className={`h-4 w-4 ${isNftBidsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NFT Address</TableHead>
                          <TableHead>Bid Amount</TableHead>
                          <TableHead>Bidder</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nftBidsData.map((bid, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                {/* Use truncateAddress here for consistency */}
                                <span>{truncateAddress(bid.nftAddress)}</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(bid.nftAddress)}
                                      >
                                        {copiedText === bid.nftAddress ? (
                                          <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {copiedText === bid.nftAddress ? "Copied!" : "Copy address"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                            <TableCell>{bid.bidAmount} SOL</TableCell>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(bid.bidder)}</span>
                                {bid.bidder !== "unknown" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => copyToClipboard(bid.bidder)}
                                        >
                                          {copiedText === bid.bidder ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {copiedText === bid.bidder ? "Copied!" : "Copy address"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatTimestamp(bid.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* NFT Prices Tab */}
            {hasCategory(categories, NFT_PRICES_SUBTYPES) && (
              <TabsContent value="nft-prices" className="mt-0">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>NFT Prices</CardTitle>
                      <CardDescription>Listings, sales, and auctions</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={refreshNftPrices}
                      disabled={isNftPricesLoading}
                      className="h-8 w-8"
                    >
                      <RefreshCw className={`h-4 w-4 ${isNftPricesLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NFT ID</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Price (SOL)</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>Seller</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nftPricesData.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(item.nftId)}</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(item.nftId)}
                                      >
                                        {copiedText === item.nftId ? (
                                          <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{copiedText === item.nftId ? "Copied!" : "Copy ID"}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                            <TableCell>{item.action}</TableCell>
                            <TableCell>{item.price}</TableCell>
                            <TableCell>{item.platform || "N/A"}</TableCell>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(item.buyer || "N/A")}</span>
                                {item.buyer && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => item.buyer && copyToClipboard(item.buyer)}
                                        >
                                          {copiedText === item.buyer ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {copiedText === item.buyer ? "Copied!" : "Copy address"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(item.seller || "N/A")}</span>
                                {item.seller && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => item.seller && copyToClipboard(item.seller)}
                                        >
                                          {copiedText === item.seller ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {copiedText === item.seller ? "Copied!" : "Copy address"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatTimestamp(item.dateTime)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Borrowable Tokens Tab */}
            {hasCategory(categories, BORROWABLE_TOKENS_SUBTYPES) && (
              <TabsContent value="borrowable-tokens" className="mt-0">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Borrowable Tokens</CardTitle>
                      <CardDescription>Loan offers, statuses, and amounts</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={refreshBorrowableTokens}
                      disabled={isBorrowableTokensLoading}
                      className="h-8 w-8"
                    >
                    <RefreshCw className={`h-4 w-4 ${isBorrowableTokensLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NFT ID</TableHead>
                          <TableHead>Loan Amount (SOL)</TableHead>
                          <TableHead>Lender</TableHead>
                          <TableHead>Borrower</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Offer Date</TableHead>
                           <TableHead>Taken Date</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {borrowableTokensData.map((token) => (
                          <TableRow key={token.id}>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(token.nftId)}</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(token.nftId)}
                                      >
                                        {copiedText === token.nftId ? (
                                          <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {copiedText === token.nftId ? "Copied!" : "Copy ID"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                            <TableCell>{token.loanAmount}</TableCell>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(token.lender)}</span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => copyToClipboard(token.lender)}
                                      >
                                        {copiedText === token.lender ? (
                                          <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {copiedText === token.lender ? "Copied!" : "Copy address"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono relative group">
                              <div className="flex items-center">
                                <span>{truncateAddress(token.borrower || "N/A")}</span>
                                {token.borrower && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => token.borrower && copyToClipboard(token.borrower)}
                                        >
                                          {copiedText === token.borrower ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {copiedText === token.borrower ? "Copied!" : "Copy address"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{token.status}</TableCell>
                            <TableCell>{formatTimestamp(token.offerDate)}</TableCell>
                            <TableCell>{token.takenDate ? formatTimestamp(token.takenDate) : "N/A"}</TableCell>
                            <TableCell>{token.dueDate ? formatTimestamp(token.dueDate) : "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Webhook Settings Tab */}
            <TabsContent value="webhook-settings" className="mt-0">
              <div className="space-y-6">
                {/* Webhook Information Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <Webhook className="h-5 w-5 mr-2" />
                          Webhook Configuration
                        </CardTitle>
                        <CardDescription>
                          View and update your Helius webhook settings
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Load Current Settings Button */}
                    <div className="flex justify-center">
                      <Button
                        onClick={fetchWebhookInfo}
                        disabled={isLoadingWebhookInfo}
                        variant="outline"
                        className="w-full md:w-auto"
                      >
                        {isLoadingWebhookInfo ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Settings className="h-4 w-4 mr-2" />
                        )}
                        Load Current Webhook Settings
                      </Button>
                    </div>

                    {/* Error Display */}
                    {webhookError && (
                      <div className="p-3 rounded-md bg-red-50 border border-red-200">
                        <p className="text-sm text-red-600">{webhookError}</p>
                      </div>
                    )}

                    {/* Success Display */}
                    {webhookUpdateSuccess && (
                      <div className="p-3 rounded-md bg-green-50 border border-green-200">
                        <p className="text-sm text-green-600">Webhook updated successfully!</p>
                      </div>
                    )}

                    {/* Current Webhook Info */}
                    {webhookInfo && (
                      <div className="space-y-4 p-4 rounded-lg bg-slate-50 border">
                        <h3 className="font-medium">Current Webhook Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-slate-500">Webhook ID:</span>
                            <p className="font-mono">{truncateAddress(webhookInfo.webhookID)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-slate-500">Status:</span>
                            <Badge variant="outline" className="ml-2">
                              {webhookInfo.status}
                            </Badge>
                          </div>
                          <div className="md:col-span-2">
                            <span className="font-medium text-slate-500">Webhook URL:</span>
                            <p className="font-mono text-xs break-all">{webhookInfo.webhookURL}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Transaction Types Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction Types</CardTitle>
                    <CardDescription>
                      Select which blockchain transaction types to monitor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Group transaction types by category */}
                      {Object.entries(
                        TRANSACTION_TYPES.reduce((acc, type) => {
                          if (!acc[type.category]) acc[type.category] = []
                          acc[type.category].push(type)
                          return acc
                        }, {} as Record<string, typeof TRANSACTION_TYPES>)
                      ).map(([category, types]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="font-medium text-sm">{category}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {types.map((type) => (
                              <div key={type.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={type.id}
                                  checked={selectedCategories.includes(type.id)}
                                  onCheckedChange={(checked) => 
                                    handleCategoryChange(type.id, checked as boolean)
                                  }
                                />
                                <Label htmlFor={type.id} className="text-sm">
                                  {type.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Token Addresses Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Account Addresses</CardTitle>
                    <CardDescription>
                      Specify which account addresses to monitor for transactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add new token address */}
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Enter account address (e.g., token mint address)"
                        value={newTokenAddress}
                        onChange={(e) => setNewTokenAddress(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTokenAddress()}
                      />
                      <Button onClick={addTokenAddress} disabled={!newTokenAddress.trim()}>
                        Add Address
                      </Button>
                    </div>

                    {/* Current token addresses */}
                    {tokenAddresses.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Current Addresses:</h4>
                        <div className="space-y-2">
                          {tokenAddresses.map((address, index) => (
                            <div key={index} className="flex items-center justify-between p-2 rounded border bg-slate-50">
                              <span className="font-mono text-sm">{address}</span>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(address)}
                                  className="h-6 w-6"
                                >
                                  {copiedText === address ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeTokenAddress(address)}
                                  className="h-6 w-6 text-red-500 hover:text-red-700"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Update Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={updateWebhook}
                    disabled={isUpdatingWebhook || selectedCategories.length === 0}
                    className="w-full md:w-auto"
                  >
                    {isUpdatingWebhook ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Updating Webhook...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Update Webhook Configuration
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

export default Dashboard

