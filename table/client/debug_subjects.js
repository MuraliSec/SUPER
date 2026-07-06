import axios from 'axios';

const testFetch = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/subjects');
        console.log('Status:', res.status);
        console.log('Subjects Count:', res.data.length);
        if (res.data.length > 0) {
            console.log('First 3 subjects:', JSON.stringify(res.data.slice(0, 3), null, 2));
        } else {
            console.log('No subjects found in DB.');
        }
    } catch (err) {
        console.error('Error fetching subjects:', err.message);
    }
};

testFetch();
