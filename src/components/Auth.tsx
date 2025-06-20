"use client"

import { useState } from "react"
import { ArrowRight, Database, Layers, Webhook, ChevronLeft, Loader2, Sparkles, Shield, Zap } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { motion, AnimatePresence } from "framer-motion"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

// Form validation schemas
const accountSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

const postgresSchema = z
  .object({
    pgConnectionString: z
      .string()
      .min(1, "Connection string is required")
      .regex(
        /^postgresql:\/\/[^:]+:[^@]+@[^/]+(?::\d+)?\/[^?\s]+(?:\?.*)?$/,
        "Invalid connection string format. Expected: postgresql://username:password@host:port/database",
      ),
    nftBids: z.boolean().default(false),
    nftPrices: z.boolean().default(false),
    borrowableTokens: z.boolean().default(false),
    tokenPrices: z.boolean().default(false),
    tokenAddress: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.nftBids && !data.nftPrices && !data.borrowableTokens && !data.tokenPrices) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select at least one data type to index",
        path: ["_error"], // Empty path to set error at root level
      })
    }

    // Make token address required when any checkbox is checked
    if ((data.nftBids || data.nftPrices || data.borrowableTokens || data.tokenPrices) && !data.tokenAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token address is required when indexing data",
        path: ["tokenAddress"],
      })
    }
  })

const Feature = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <motion.div 
    className="group flex gap-4 p-6 rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 hover:shadow-lg hover:shadow-blue-100/25 border border-transparent hover:border-blue-100/50"
    whileHover={{ scale: 1.02, y: -2 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
  >
    <div className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-all duration-300 ring-1 ring-blue-200/30 group-hover:ring-blue-300/50">
      <Icon className="h-7 w-7 text-blue-600 group-hover:text-blue-700 transition-colors duration-300" />
    </div>
    <div className="space-y-1">
      <h3 className="font-semibold text-slate-800 group-hover:text-slate-900 transition-colors duration-300">{title}</h3>
      <p className="text-sm text-slate-600 group-hover:text-slate-700 transition-colors duration-300 leading-relaxed">{description}</p>
    </div>
  </motion.div>
)

export default function AuthPage() {
  const [step, setStep] = useState(1)
  const [isLoginMode, setIsLoginMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const accountForm = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const postgresForm = useForm({
    resolver: zodResolver(postgresSchema),
    defaultValues: {
      pgConnectionString: "",
      nftBids: false,
      nftPrices: false,
      borrowableTokens: false,
      tokenPrices: false,
      tokenAddress: "",
    },
  })

  const onAccountSubmit = () => {
    setStep(2)
  }

  const onPostgresSubmit = async () => {
    setIsSubmitting(true)
    try {
      const categories = []
      if (postgresForm.getValues("nftBids"))
        categories.push("NFT_BID", "NFT_BID_CANCELLED", "NFT_GLOBAL_BID", "NFT_GLOBAL_BID_CANCELLED")
      if (postgresForm.getValues("nftPrices"))
        categories.push("NFT_LISTING", "NFT_CANCEL_LISTING", "NFT_SALE", "NFT_MINT", "NFT_AUCTION_CREATED", "NFT_AUCTION_UPDATED", "NFT_AUCTION_CANCELLED")
      if (postgresForm.getValues("borrowableTokens")) categories.push("LOAN", "REPAY_LOAN")
      if (postgresForm.getValues("tokenPrices")) categories.push("SWAP", "ADD_TO_POOL", "REMOVE_FROM_POOL", "BUY", "SELL")

      // Use the single token address for all selected categories
      const tokenAddress = postgresForm.getValues("tokenAddress")
      const tokenAddresses: string[] = tokenAddress ? [tokenAddress] : []

      const response = await axios.post(`${BACKEND_URL}/api/signup`, {
        email: accountForm.getValues("email"),
        password: accountForm.getValues("password"),
        connectionString: postgresForm.getValues("pgConnectionString"),
        categories: categories,
        tokenAddress: tokenAddresses,
      })

      if (response.status === 201) {
        localStorage.setItem("token", `${(response.data as { token: string }).token}`)
        toast("Success", {
          description: (response.data as { message?: string }).message || "User created successfully.",
        })
        navigate("/dashboard")
      } else if (response.status === 409) {
        toast("Error", {
          description: "User with this Email already exists.",
        })
      } else {
        toast("Error", {
          description: `Unexpected response: ${response.status}`,
        })
      }
    } catch (error: any) {
      // Check if axios returned a response with a specific status code
      if (error.response && error.response.status === 409) {
        toast("Error", {
          description: error.response.data.error || "User with this Email already exists.",
        })
      } else {
        toast("Error", {
          description: "Something went wrong. Please try again.",
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const validateConnectionString = async (connectionString: string) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/validate-pg-connection`, {
        connectionString,
      })

      if (response.status === 200) {
        toast("Success", {
          description: "Connection string is valid.",
        })
      } else {
        toast("Error", {
          description: "Invalid connection string. Make sure it is running at the specified host and port.",
        })
      }
    } catch (error: any) {
      if (error.response) {
        toast("Error", {
          description: error.response.data.message || "Invalid connection string.",
        })
      } else {
        toast("Error", {
          description: "Something went wrong.",
        })
      }
    }
  }

  const onLoginSubmit = async (data: z.infer<typeof accountSchema>) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/login`, {
        email: data.email,
        password: data.password,
      })

      if (response.status === 200) {
        localStorage.setItem("token", `${(response.data as { token: string }).token}`)
        toast("Success", {
          description: "Logged in successfully.",
        })
        navigate("/dashboard")
      } else {
        toast("Error", {
          description: "Invalid credentials.",
        })
      }
    } catch (error: any) {
      if (error.response) {
        // Handle specific error responses from the server
        if (error.response.status === 401) {
          toast("Authentication Failed", {
            description: "Invalid email or password. Please check your credentials and try again.",
          })
        } else if (error.response.status === 429) {
          toast("Too Many Attempts", {
            description: "Too many login attempts. Please try again later.",
          })
        } else {
          toast("Server Error", {
            description: error.response.data?.message || "An unexpected server error occurred. Please try again.",
          })
        }
      } else if (error.request) {
        // The request was made but no response was received
        toast("Connection Error", {
          description: "Unable to connect to the server. Please check your internet connection and try again.",
        })
      } else {
        // Something happened in setting up the request
        toast("Error", {
          description: "An unexpected error occurred. Please try again.",
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-slate-200/40 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl -z-10" />
      
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl w-full">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 xl:gap-20 items-center">
            {/* Left Column - Marketing Content */}
            <motion.div 
              className="flex flex-col space-y-8 lg:space-y-10 order-2 lg:order-1"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="space-y-6">
                <motion.div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-sm font-medium text-blue-700 border border-blue-200/50"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <Sparkles className="w-4 h-4" />
                  Next-Generation Blockchain Indexing
                </motion.div>
                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 leading-tight">
                    Soldex: Simplify Blockchain Data Indexing
                  </h1>
                  <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                    Transform how you interact with Solana blockchain data. Soldex enables developers to seamlessly integrate and index blockchain data into PostgreSQL databases without complex infrastructure management.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <Feature
                  icon={Database}
                  title="Direct PostgreSQL Integration"
                  description="Stream blockchain data directly into your PostgreSQL database with zero configuration hassle and real-time synchronization."
                />
                <Feature
                  icon={Webhook}
                  title="Helius-Powered Webhooks"
                  description="Leverage enterprise-grade Helius webhooks for reliable, high-performance data streaming with built-in redundancy."
                />
                <Feature
                  icon={Layers}
                  title="Zero Infrastructure Management"
                  description="Skip the complexity of RPC nodes, Geyser plugins, validators, and webhook infrastructure. We handle it all."
                />
              </div>

              {/* Additional features badges */}
              <div className="flex flex-wrap gap-3 pt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  <Shield className="w-3 h-3" />
                  Enterprise Security
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  <Zap className="w-3 h-3" />
                  Real-time Updates
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                  <Database className="w-3 h-3" />
                  99.9% Uptime
                </div>
              </div>
            </motion.div>

            {/* Right Column - Auth Forms */}
            <div className="flex items-center justify-center order-1 lg:order-2">
              <div className="w-full max-w-xl lg:max-w-none">
                <AnimatePresence mode="wait">
                  {isLoginMode ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: 20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Card className="shadow-xl shadow-blue-100/25 border-blue-100/50 bg-white/80 backdrop-blur-sm">
                        <Form {...accountForm}>
                          <form onSubmit={accountForm.handleSubmit(onLoginSubmit)}>
                            <CardHeader className="text-center space-y-2 pb-8">
                              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-blue-900">
                                Welcome Back
                              </CardTitle>
                              <CardDescription className="text-slate-600">
                                Sign in to continue to your Soldex dashboard
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              <FormField
                                control={accountForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-700 font-medium">Email Address</FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="you@example.com" 
                                        className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-100" 
                                        {...field} 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accountForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-700 font-medium">Password</FormLabel>
                                    <FormControl>
                                      <Input 
                                        type="password" 
                                        className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-100" 
                                        {...field} 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </CardContent>
                            <CardFooter className="flex flex-col space-y-4 pt-6">
                              <Button
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full h-11 font-medium shadow-lg shadow-blue-200/25 hover:shadow-xl hover:shadow-blue-300/25 transition-all duration-200"
                                type="submit"
                              >
                                Sign In
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                              <div className="text-center text-sm text-slate-600">
                                Don't have an account?{" "}
                                <button
                                  type="button"
                                  onClick={() => setIsLoginMode(false)}
                                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline bg-transparent border-none p-0 cursor-pointer transition-colors"
                                >
                                  Create one now
                                </button>
                              </div>
                            </CardFooter>
                          </form>
                        </Form>
                      </Card>
                    </motion.div>
                  ) : step === 1 ? (
                    <motion.div
                      key="account"
                      initial={{ opacity: 0, x: 20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Card className="shadow-xl shadow-blue-100/25 border-blue-100/50 bg-white/80 backdrop-blur-sm">
                        <Form {...accountForm}>
                          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)}>
                            <CardHeader className="text-center space-y-2 pb-8">
                              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-blue-900">
                                Get Started
                              </CardTitle>
                              <CardDescription className="text-slate-600">
                                Create your Soldex account to start indexing blockchain data
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              <FormField
                                control={accountForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-700 font-medium">Email Address</FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="you@example.com" 
                                        className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-100" 
                                        {...field} 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={accountForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-700 font-medium">Password</FormLabel>
                                    <FormControl>
                                      <Input 
                                        type="password" 
                                        className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-100" 
                                        {...field} 
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </CardContent>
                            <CardFooter className="flex flex-col space-y-4 pt-6">
                              <Button
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full h-11 font-medium shadow-lg shadow-blue-200/25 hover:shadow-xl hover:shadow-blue-300/25 transition-all duration-200"
                                type="submit"
                              >
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                              <div className="text-center text-sm text-slate-600">
                                Already have an account?{" "}
                                <button
                                  type="button"
                                  onClick={() => setIsLoginMode(true)}
                                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline bg-transparent border-none p-0 cursor-pointer transition-colors"
                                >
                                  Sign in
                                </button>
                              </div>
                            </CardFooter>
                          </form>
                        </Form>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="postgres"
                      initial={{ opacity: 0, x: 20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <Card className="shadow-xl shadow-blue-100/25 border-blue-100/50 bg-white/80 backdrop-blur-sm">
                        <Form {...postgresForm}>
                          <form onSubmit={postgresForm.handleSubmit(onPostgresSubmit)}>
                            <CardHeader className="text-center space-y-2 pb-8">
                              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-blue-900">
                                Database Configuration
                              </CardTitle>
                              <CardDescription className="text-slate-600">
                                Connect your PostgreSQL database and configure data indexing
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              <FormField
                                control={postgresForm.control}
                                name="pgConnectionString"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-700 font-medium">Database Connection String</FormLabel>
                                    <FormControl>
                                      <div className="relative w-full">
                                        <Input
                                          placeholder="postgresql://username:password@host:port/database"
                                          {...field}
                                          className="h-11 pr-20 border-slate-200 focus:border-blue-300 focus:ring-blue-100 font-mono text-sm"
                                        />
                                        {field.value?.length > 0 && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            onClick={async () => {
                                              await validateConnectionString(field.value)
                                            }}
                                          >
                                            Test
                                          </Button>
                                        )}
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="space-y-6 pt-6 border-t border-slate-200">
                                <div className="space-y-2">
                                  <h3 className="font-semibold text-slate-800">Data Types to Index</h3>
                                  <p className="text-sm text-slate-600">Select the blockchain data you want to monitor and store</p>
                                  {(postgresForm.formState.errors as any)._error && (
                                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                                      <p className="text-sm font-medium text-red-600">
                                        {(postgresForm.formState.errors as any)._error.message}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <FormField
                                    control={postgresForm.control}
                                    name="nftBids"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col space-y-3">
                                        <div className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={(checked) => {
                                                field.onChange(checked)
                                              }}
                                              className="mt-0.5"
                                            />
                                          </FormControl>
                                          <div className="space-y-1 flex-1">
                                            <FormLabel className="text-slate-800 font-medium cursor-pointer">NFT Bids</FormLabel>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                              Track and index NFT marketplace bids and offers in real-time
                                            </p>
                                          </div>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={postgresForm.control}
                                    name="tokenPrices"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col space-y-3">
                                        <div className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={(checked) => {
                                                field.onChange(checked)
                                              }}
                                              className="mt-0.5"
                                            />
                                          </FormControl>
                                          <div className="space-y-1 flex-1">
                                            <FormLabel className="text-slate-800 font-medium cursor-pointer">Token Prices</FormLabel>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                              Index real-time token prices and market data from DEXs
                                            </p>
                                          </div>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={postgresForm.control}
                                    name="borrowableTokens"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col space-y-3">
                                        <div className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={(checked) => {
                                                field.onChange(checked)
                                              }}
                                              className="mt-0.5"
                                            />
                                          </FormControl>
                                          <div className="space-y-1 flex-1">
                                            <FormLabel className="text-slate-800 font-medium cursor-pointer">Borrowable Tokens</FormLabel>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                              Index tokens available for borrowing and lending protocols
                                            </p>
                                          </div>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={postgresForm.control}
                                    name="nftPrices"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-col space-y-3">
                                        <div className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={(checked) => {
                                                field.onChange(checked)
                                              }}
                                              className="mt-0.5"
                                            />
                                          </FormControl>
                                          <div className="space-y-1 flex-1">
                                            <FormLabel className="text-slate-800 font-medium cursor-pointer">NFT Prices</FormLabel>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                              Index NFT prices and historical sales data from marketplaces
                                            </p>
                                          </div>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>

                              {/* Common Token Address Field */}
                              <FormField
                                control={postgresForm.control}
                                name="tokenAddress"
                                render={({ field }) => (
                                  <FormItem className="space-y-3">
                                    <FormLabel className="text-slate-700 font-medium">Token/Collection Address</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Enter token mint or NFT collection address to monitor"
                                        className="h-11 border-slate-200 focus:border-blue-300 focus:ring-blue-100 font-mono"
                                        {...field}
                                      />
                                    </FormControl>
                                    <div className="text-xs text-slate-600 leading-relaxed">
                                      This address will be used for all selected transaction types above. For NFT-related data, enter the collection address. For token data, enter the mint address.
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </CardContent>
                            <CardFooter className="flex flex-col space-y-4 pt-8">
                              <div className="flex w-full gap-3">
                                <Button
                                  variant="outline"
                                  type="button"
                                  onClick={() => setStep(1)}
                                  className="h-11 px-6 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                                >
                                  <ChevronLeft className="mr-2 h-4 w-4" />
                                  Back
                                </Button>
                                <Button
                                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex-1 h-11 font-medium shadow-lg shadow-blue-200/25 hover:shadow-xl hover:shadow-blue-300/25 transition-all duration-200"
                                  type="submit"
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Setting up your indexer...
                                    </>
                                  ) : (
                                    <>
                                      Complete Setup
                                      <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                  )}
                                </Button>
                              </div>
                            </CardFooter>
                          </form>
                        </Form>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 