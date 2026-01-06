import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const testUpload = async () => {
  try {
    const form = new FormData();
    
    // Add test files
    const cvFiles = [
      'MERN_CV_Level_1.pdf',
      'MERN_CV_Level_2.pdf',
      'MERN_CV_Level_3.pdf',
      'MERN_CV_Level_4.pdf'
    ];
    
    for (const file of cvFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        form.append('files', fs.createReadStream(filePath), file);
        console.log(`✓ Added ${file} to form`);
      } else {
        console.log(`✗ File not found: ${file}`);
      }
    }
    
    console.log('\nSending request to http://localhost:3001/analyzer/upload');
    const response = await fetch('http://localhost:3001/analyzer/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const data = await response.json();
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testUpload();
