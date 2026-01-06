import { useState } from 'react';
import apiClient from '../services/apiClient';
import { API_BASE_URL, TENANT_HEADER } from '../constants/api';

export default function DebugAPI() {
    const [results, setResults] = useState({});
    const [loading, setLoading] = useState(false);

    const testEndpoint = async (endpoint, method = 'GET', data = null) => {
        setLoading(true);
        const key = `${method}_${endpoint}`;
        
        try {
            console.log(`\n🧪 Testing ${method} ${endpoint}`);
            let response;
            
            if (method === 'GET') {
                response = await apiClient.get(endpoint);
            } else if (method === 'POST') {
                response = await apiClient.post(endpoint, data);
            }
            
            setResults(prev => ({
                ...prev,
                [key]: {
                    success: true,
                    status: response.status,
                    data: response.data
                }
            }));
        } catch (error) {
            setResults(prev => ({
                ...prev,
                [key]: {
                    success: false,
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data
                }
            }));
        }
        setLoading(false);
    };

    const testWithTenant = async () => {
        localStorage.setItem('tenantId', 'pizza-palace');
        await testEndpoint('/menu');
    };

    const testWithoutTenant = async () => {
        localStorage.removeItem('tenantId');
        await testEndpoint('/restaurants');
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h1>🧪 Debug API Tester</h1>
            <p>Base URL: {API_BASE_URL}</p>
            
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                    onClick={() => testEndpoint('/restaurants')}
                    style={{ padding: '10px', cursor: 'pointer' }}
                >
                    GET /restaurants
                </button>
                
                <button 
                    onClick={testWithTenant}
                    style={{ padding: '10px', cursor: 'pointer' }}
                >
                    GET /menu (with tenant)
                </button>
                
                <button 
                    onClick={testWithoutTenant}
                    style={{ padding: '10px', cursor: 'pointer' }}
                >
                    GET /restaurants (without tenant)
                </button>

                <button 
                    onClick={() => {
                        localStorage.clear();
                        setResults({});
                        console.clear();
                    }}
                    style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#f0f0f0' }}
                >
                    Clear
                </button>
            </div>

            <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '15px', 
                borderRadius: '5px',
                maxHeight: '600px',
                overflowY: 'auto'
            }}>
                <h3>Results:</h3>
                {Object.entries(results).map(([key, result]) => (
                    <div key={key} style={{ 
                        marginBottom: '15px', 
                        padding: '10px',
                        backgroundColor: result.success ? '#e8f5e9' : '#ffebee',
                        borderLeft: `4px solid ${result.success ? '#4caf50' : '#f44336'}`
                    }}>
                        <strong>{key}</strong>
                        <div style={{ color: result.success ? '#2e7d32' : '#c62828' }}>
                            Status: {result.status || 'N/A'}
                        </div>
                        {result.message && <div style={{ color: '#d32f2f' }}>Error: {result.message}</div>}
                        <pre style={{ 
                            fontSize: '11px', 
                            overflow: 'auto',
                            maxHeight: '200px',
                            backgroundColor: 'white',
                            padding: '10px',
                            borderRadius: '3px'
                        }}>
                            {JSON.stringify(result.data, null, 2)}
                        </pre>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
                <h3>📋 Instructions:</h3>
                <ol>
                    <li>Open DevTools (F12) and check Console</li>
                    <li>Click buttons to test endpoints</li>
                    <li>Check both the results below AND the Console logs</li>
                    <li>Look for:
                        <ul>
                            <li>🌐 Full URL</li>
                            <li>🔑 Token presence</li>
                            <li>🏪 Tenant ID presence</li>
                            <li>Response status and headers</li>
                        </ul>
                    </li>
                </ol>
            </div>
        </div>
    );
}
