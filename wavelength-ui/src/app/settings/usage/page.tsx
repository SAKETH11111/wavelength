"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  DollarSign, 
  MessageSquare, 
  Cpu, 
  TrendingUp,
  Download,
  Loader2,
  AlertCircle,
  BarChart3,
  Shield
} from 'lucide-react';
import { useStore } from '@/lib/store';

interface UsageData {
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
  totals: {
    requests: number;
    tokens: {
      total: number;
      input: number;
      output: number;
      reasoning: number;
    };
    cost: number;
  };
  breakdown: {
    providers: Array<{
      provider: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
    models: Array<{
      model: string;
      requests: number;
      tokens: number;
      cost: number;
    }>;
  };
  dailyUsage: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  quotaLimits: Array<{
    type: string;
    provider?: string;
    model?: string;
    requestLimit?: number;
    tokenLimit?: number;
    costLimit?: number;
    usedRequests: number;
    usedTokens: number;
    usedCost: number;
    resetAt: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export default function UsagePage() {
  const { auth } = useStore();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedProvider] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsageData = useCallback(async () => {
    try {
      let url = `/api/profile/usage?period=${selectedPeriod}`;
      if (selectedProvider) {
        url += `&provider=${selectedProvider}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setUsageData(data.data);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load usage data' });
      }
    } catch (error) {
      console.error('Failed to load usage data:', error);
      setMessage({ type: 'error', text: 'Failed to load usage data' });
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedProvider]);

  useEffect(() => {
    if (auth.user.sessionType === 'authenticated') {
      loadUsageData();
    } else {
      setLoading(false);
    }
  }, [auth.user.sessionType, selectedPeriod, selectedProvider, loadUsageData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const exportUsageData = () => {
    if (!usageData) return;

    const exportData = {
      period: usageData.period,
      dateRange: usageData.dateRange,
      totals: usageData.totals,
      breakdown: usageData.breakdown,
      dailyUsage: usageData.dailyUsage,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wavelength-usage-${usageData.period}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getQuotaUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (auth.user.sessionType === 'anonymous') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Analytics</CardTitle>
          <CardDescription>Sign in to view your usage analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              Usage analytics are only available for signed-in users. Please sign in to view your usage statistics.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading usage data...</span>
        </CardContent>
      </Card>
    );
  }

  if (!usageData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Usage Data</h3>
          <p className="text-muted-foreground">Start using AI models to see your analytics here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Usage Analytics
              </CardTitle>
              <CardDescription>
                Track your AI usage, costs, and quotas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportUsageData} className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {message && (
        <Alert className={message.type === 'error' ? 'border-destructive' : 'border-green-200'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <BarChart3 className="h-4 w-4 text-green-600" />
          )}
          <AlertDescription className={message.type === 'success' ? 'text-green-700' : ''}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Requests</span>
            </div>
            <div className="text-2xl font-bold mt-2">{formatNumber(usageData.totals.requests)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Tokens</span>
            </div>
            <div className="text-2xl font-bold mt-2">{formatNumber(usageData.totals.tokens.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(usageData.totals.tokens.input)} input, {formatNumber(usageData.totals.tokens.output)} output
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Cost</span>
            </div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(usageData.totals.cost)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Estimated spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Reasoning Tokens</span>
            </div>
            <div className="text-2xl font-bold mt-2">{formatNumber(usageData.totals.tokens.reasoning)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Advanced reasoning
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage</CardTitle>
              <CardDescription>Your usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usageData.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value, name) => [
                        name === 'cost' ? formatCurrency(value as number) : formatNumber(value as number),
                        name === 'cost' ? 'Cost' : name === 'tokens' ? 'Tokens' : 'Requests'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="requests" 
                      stackId="1" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="tokens" 
                      stackId="2" 
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Provider Distribution</CardTitle>
                <CardDescription>Usage by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={usageData.breakdown.providers}
                        dataKey="cost"
                        nameKey="provider"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ provider, value }: any) => `${provider}: ${formatCurrency(value || 0)}`}
                      >
                        {usageData.breakdown.providers.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provider Stats</CardTitle>
                <CardDescription>Detailed breakdown by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {usageData.breakdown.providers.map((provider, index) => (
                    <div key={provider.provider} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                      <div>
                        <h4 className="font-medium capitalize">{provider.provider}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(provider.requests)} requests • {formatNumber(provider.tokens)} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(provider.cost)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Models</CardTitle>
              <CardDescription>Your most used models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageData.breakdown.models.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="model" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'cost' ? formatCurrency(value as number) : formatNumber(value as number),
                        name === 'cost' ? 'Cost' : name === 'tokens' ? 'Tokens' : 'Requests'
                      ]}
                    />
                    <Bar dataKey="cost" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Quotas</CardTitle>
              <CardDescription>Monitor your usage limits</CardDescription>
            </CardHeader>
            <CardContent>
              {usageData.quotaLimits.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Quotas</h3>
                  <p className="text-muted-foreground">
                    Set up usage limits to manage your spending and usage
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {usageData.quotaLimits.map((quota, idx) => (
                    <div key={idx} className="p-4 border rounded-md">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">
                            {quota.provider ? `${quota.provider}${quota.model ? ` - ${quota.model}` : ''}` : 'General Limit'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Resets: {new Date(quota.resetAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={quota.type === 'daily' ? 'default' : 'secondary'}>
                          {quota.type}
                        </Badge>
                      </div>

                      {quota.requestLimit && (
                        <div className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Requests</span>
                            <span>{quota.usedRequests} / {quota.requestLimit}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getQuotaColor(getQuotaUsagePercentage(quota.usedRequests, quota.requestLimit))}`}
                              style={{ width: `${getQuotaUsagePercentage(quota.usedRequests, quota.requestLimit)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {quota.tokenLimit && (
                        <div className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Tokens</span>
                            <span>{formatNumber(quota.usedTokens)} / {formatNumber(quota.tokenLimit)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getQuotaColor(getQuotaUsagePercentage(quota.usedTokens, quota.tokenLimit))}`}
                              style={{ width: `${getQuotaUsagePercentage(quota.usedTokens, quota.tokenLimit)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {quota.costLimit && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Cost</span>
                            <span>{formatCurrency(quota.usedCost)} / {formatCurrency(quota.costLimit)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getQuotaColor(getQuotaUsagePercentage(quota.usedCost, quota.costLimit))}`}
                              style={{ width: `${getQuotaUsagePercentage(quota.usedCost, quota.costLimit)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}