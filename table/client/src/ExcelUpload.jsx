import React, { useState } from 'react';
import api from './api/axios';

const ExcelUpload = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [viewType, setViewType] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const handleViewData = async (type) => {
        try {
            const response = await api.get(`/${type}`);
            setViewData(response.data);
            setViewType(type);
            setSearchTerm("");
        } catch (err) {
            console.error(`Failed to fetch ${type}:`, err);
            setError(`Failed to fetch ${type} data`);
        }
    };

    // Filter logic
    const filteredData = viewData
        ? viewData.filter(item => {
            if (!searchTerm) return true;
            return Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );
        })
        : [];

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setError(null);
        setResults(null);
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setError(null);
        setResults(null);

        try {
            const response = await api.post('/excel/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setResults(response.data.results);
            fetchStats();
        } catch (err) {
            console.error('Upload error:', err);

            // Detailed error message
            let errorMessage = 'Failed to upload file';

            if (err.response) {
                // Server responded with error
                errorMessage = err.response.data?.error || err.response.data?.details || 'Server error occurred';
                console.error('Server error:', err.response.data);
            } else if (err.request) {
                // Request was made but no response
                errorMessage = 'No response from server. Please check if the server is running on port 5000.';
                console.error('No response:', err.request);
            } else {
                // Error in request setup
                errorMessage = err.message || 'Failed to upload file';
                console.error('Request error:', err.message);
            }

            setError(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/excel/stats');
            setStats(response.data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    React.useEffect(() => {
        fetchStats();
    }, []);

    return (
        <div style={{ padding: '30px', width: '100%' }}>
            <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                marginBottom: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
            }}>
                 Excel Data Upload
            </h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
                Upload your Excel file containing Faculty, Rooms, Batches, and Course data
            </p>

            {/* Upload Section */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '30px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                marginBottom: '30px'
            }}>
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{
                            fontWeight: '600',
                            color: '#333'
                        }}>
                            Select Excel File (.xlsx, .xls)
                        </label>
                        <a 
                            href={`${api.defaults.baseURL}/excel/template`} 
                            download 
                            style={{
                                color: '#667eea',
                                textDecoration: 'none',
                                fontSize: '14px',
                                fontWeight: '600',
                                border: '1px solid #667eea',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                transition: 'all 0.2s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#667eea';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#667eea';
                            }}
                        >
                             Download Template
                        </a>
                    </div>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        style={{
                            width: '100%',
                            padding: '12px',
                            border: '2px dashed #667eea',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: '#f8f9ff'
                        }}
                    />
                </div>

                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: uploading
                            ? '#ccc'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {uploading ? ' Uploading...' : ' Upload and Process'}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div style={{
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '20px',
                    color: '#c33'
                }}>
                    <strong> Error:</strong> {error}
                </div>
            )}

            {/* Results Display */}
            {results && (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '30px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    marginBottom: '30px'
                }}>
                    <h3 style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: '20px',
                        color: '#2d3748'
                    }}>
                         Upload Results
                    </h3>

                    <div style={{ gap: '20px' }} className="grid grid-cols-1 md:grid-cols-2">
                        {/* Faculty Results */}
                        <div style={{
                            padding: '20px',
                            background: '#f0f9ff',
                            borderRadius: '8px',
                            border: '1px solid #bae6fd'
                        }}>
                            <h4 style={{ fontWeight: '600', marginBottom: '10px', color: '#0369a1' }}>
                                ‍ Faculty
                            </h4>
                            <p>Added: <strong>{results.faculty.added}</strong></p>
                            <p>Updated: <strong>{results.faculty.updated}</strong></p>
                            {results.faculty.errors.length > 0 && (
                                <p style={{ color: '#dc2626' }}>
                                    Errors: {results.faculty.errors.length}
                                </p>
                            )}
                        </div>

                        {/* Rooms Results */}
                        <div style={{
                            padding: '20px',
                            background: '#f0fdf4',
                            borderRadius: '8px',
                            border: '1px solid #bbf7d0'
                        }}>
                            <h4 style={{ fontWeight: '600', marginBottom: '10px', color: '#15803d' }}>
                                 Rooms
                            </h4>
                            <p>Added: <strong>{results.rooms.added}</strong></p>
                            <p>Updated: <strong>{results.rooms.updated}</strong></p>
                            {results.rooms.errors.length > 0 && (
                                <p style={{ color: '#dc2626' }}>
                                    Errors: {results.rooms.errors.length}
                                </p>
                            )}
                        </div>

                        {/* Batches Results */}
                        <div style={{
                            padding: '20px',
                            background: '#fef3c7',
                            borderRadius: '8px',
                            border: '1px solid #fde68a'
                        }}>
                            <h4 style={{ fontWeight: '600', marginBottom: '10px', color: '#92400e' }}>
                                 Batches
                            </h4>
                            <p>Added: <strong>{results.batches.added}</strong></p>
                            <p>Updated: <strong>{results.batches.updated}</strong></p>
                            {results.batches.errors.length > 0 && (
                                <p style={{ color: '#dc2626' }}>
                                    Errors: {results.batches.errors.length}
                                </p>
                            )}
                        </div>

                        {/* Courses Results */}
                        <div style={{
                            padding: '20px',
                            background: '#fce7f3',
                            borderRadius: '8px',
                            border: '1px solid #fbcfe8'
                        }}>
                            <h4 style={{ fontWeight: '600', marginBottom: '10px', color: '#9f1239' }}>
                                 Courses
                            </h4>
                            <p>Added: <strong>{results.courses.added}</strong></p>
                            <p>Updated: <strong>{results.courses.updated}</strong></p>
                            {results.courses.errors.length > 0 && (
                                <p style={{ color: '#dc2626' }}>
                                    Errors: {results.courses.errors.length}
                                </p>
                            )}
                        </div>


                    </div>

                    {/* Detailed Errors */}
                    {(results.faculty.errors.length > 0 ||
                        results.rooms.errors.length > 0 ||
                        results.batches.errors.length > 0 ||
                        results.courses.errors.length > 0) && (
                            <div style={{ marginTop: '30px' }}>
                                <h4 style={{
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    marginBottom: '15px',
                                    color: '#dc2626'
                                }}>
                                     Detailed Errors
                                </h4>

                                {results.faculty.errors.length > 0 && (
                                    <div style={{
                                        marginBottom: '15px',
                                        padding: '15px',
                                        background: '#fef2f2',
                                        borderRadius: '8px',
                                        border: '1px solid #fecaca'
                                    }}>
                                        <strong style={{ color: '#991b1b' }}>Faculty Errors ({results.faculty.errors.length}):</strong>
                                        <ul style={{ marginTop: '10px', marginLeft: '20px', fontSize: '14px' }}>
                                            {results.faculty.errors.slice(0, 10).map((err, i) => (
                                                <li key={i} style={{ marginBottom: '5px', color: '#7f1d1d' }}>{err}</li>
                                            ))}
                                            {results.faculty.errors.length > 10 && (
                                                <li style={{ fontStyle: 'italic', color: '#991b1b' }}>
                                                    ... and {results.faculty.errors.length - 10} more errors
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                </div>
            )}

            {/* Database Statistics */}
            {stats && (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '30px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        marginBottom: '20px',
                        color: '#2d3748'
                    }}>
                         Database Statistics
                    </h3>

                    <div style={{ gap: '15px' }} className="grid grid-cols-2 md:grid-cols-4">
                        <div
                            style={{ textAlign: 'center', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}
                        >
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
                                {stats.faculty}
                            </div>
                            <div style={{ color: '#64748b', marginTop: '5px' }}>Faculty</div>
                        </div>
                        <div
                            style={{ textAlign: 'center', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}
                        >
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
                                {stats.rooms}
                            </div>
                            <div style={{ color: '#64748b', marginTop: '5px' }}>Rooms</div>
                        </div>
                        <div
                            style={{ textAlign: 'center', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}
                        >
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>
                                {stats.batches}
                            </div>
                            <div style={{ color: '#64748b', marginTop: '5px' }}>Batches</div>
                        </div>
                        <div
                            style={{ textAlign: 'center', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}
                        >
                            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ec4899' }}>
                                {stats.courses}
                            </div>
                            <div style={{ color: '#64748b', marginTop: '5px' }}>Courses</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Viewer Modal */}
            {viewData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '30px',
                        width: '90%',
                        maxWidth: '1000px',
                        maxHeight: '80vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '24px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                                {viewType} List
                            </h3>

                            <input
                                type="text"
                                placeholder={`Search ${viewType}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    width: '300px',
                                    marginRight: '20px'
                                }}
                            />

                            <button
                                onClick={() => setViewData(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >
                                
                            </button>
                        </div>

                        <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        {viewData.length > 0 && Object.keys(viewData[0]).filter(k => !['_id', '__v', 'subjects'].includes(k)).map(key => (
                                            <th key={key} style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#475569', textTransform: 'capitalize' }}>
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((item, index) => (
                                        <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            {Object.keys(item).filter(k => !['_id', '__v', 'subjects'].includes(k)).map(key => (
                                                <td key={key} style={{ padding: '12px', color: '#334155' }}>
                                                    {typeof item[key] === 'object' ? JSON.stringify(item[key]) : item[key]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredData.length === 0 && (
                                <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No matching data found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div style={{
                marginTop: '30px',
                padding: '20px',
                background: '#f8f9ff',
                borderRadius: '8px',
                border: '1px solid #e0e7ff'
            }}>
                <h4 style={{ fontWeight: '600', marginBottom: '10px', color: '#4338ca' }}>
                     Excel File Requirements:
                </h4>
                <ul style={{ marginLeft: '20px', color: '#64748b', lineHeight: '1.8' }}>
                    <li>
                        <strong>Faculty Sheet:</strong> Emp ID, Employee Name, Department, Email
                        <a href={`${api.defaults.baseURL}/excel/template/faculty`} download style={{ marginLeft: '10px', color: '#4338ca', fontSize: '13px', textDecoration: 'underline' }}>Download Faculty Template</a>
                    </li>
                    <li>
                        <strong>Rooms Sheet:</strong> Room ID, Room Name/Number, Room Type, Capacity, Session
                        <a href={`${api.defaults.baseURL}/excel/template/rooms`} download style={{ marginLeft: '10px', color: '#4338ca', fontSize: '13px', textDecoration: 'underline' }}>Download Rooms Template</a>
                    </li>
                    <li>
                        <strong>Batches Sheet:</strong> Semester, Batch, Degree, Year, School/Department, Session
                        <a href={`${api.defaults.baseURL}/excel/template/batches`} download style={{ marginLeft: '10px', color: '#4338ca', fontSize: '13px', textDecoration: 'underline' }}>Download Batches Template</a>
                    </li>
                    <li>
                        <strong>Course Data Sheets:</strong> Emp ID, Faculty, Course code, Subject, Type, Batch, Course L/T/P, Credits, Year, Semester, Program, Department, Faculty L/T/P, Total Load, Session
                        <a href={`${api.defaults.baseURL}/excel/template/courses`} download style={{ marginLeft: '10px', color: '#4338ca', fontSize: '13px', textDecoration: 'underline' }}>Download Course Template</a>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default ExcelUpload;
