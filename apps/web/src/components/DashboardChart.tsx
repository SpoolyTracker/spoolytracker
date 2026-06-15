import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Simple hash to color
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

interface DashboardChartProps {
    data: Record<string, unknown>[];
    keys?: string[];
    viewMode?: 'weight' | 'cost';
    colorMap?: Record<string, string>;
    chartType?: 'bar' | 'line';
    showLegend?: boolean;
}

export default function DashboardChart({ data, keys = [], viewMode = 'weight', colorMap = {}, chartType = 'bar', showLegend = false }: DashboardChartProps) {

    // Format value for axis/tooltip
    const formatValue = (value: number) => {
        if (viewMode === 'cost') {
            return `${value.toFixed(2)}€`;
        }
        return `${Math.round(value)}g`;
    };

    const ChartComponent = chartType === 'line' ? LineChart : BarChart;

    return (
        <div style={{ width: '100%', height: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
                <ChartComponent
                    data={data}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatValue}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: number, name: string) => [formatValue(value), name]}
                    />
                    {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
                    {keys.length > 0 ? (
                        keys.map((key) => (
                            chartType === 'line' ? (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={colorMap[key] || stringToColor(key)}
                                    activeDot={{ r: 6 }}
                                    strokeWidth={3}
                                    dot={{ r: 0 }} // Clean lines
                                    name={key}
                                />
                            ) : (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    stackId="a"
                                    fill={colorMap[key] || stringToColor(key)}
                                    stroke="rgba(255,255,255,0.8)"
                                    strokeWidth={1}
                                    radius={[4, 4, 0, 0]}
                                    name={key}
                                />
                            )
                        ))
                    ) : (
                        chartType === 'line' ? (
                            <Line
                                type="monotone"
                                dataKey="amount"
                                stroke="#6366f1"
                                strokeWidth={3}
                                name={viewMode === 'cost' ? 'Cost' : 'Consumption'}
                            />
                        ) : (
                            <Bar
                                dataKey="amount"
                                fill="#6366f1"
                                radius={[4, 4, 0, 0]}
                                name={viewMode === 'cost' ? 'Cost' : 'Consumption'}
                            />
                        )
                    )}
                </ChartComponent>
            </ResponsiveContainer>
        </div>
    );
}
