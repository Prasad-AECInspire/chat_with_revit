import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import yaml from 'js-yaml';

const MergeDatasets = ({ onBackToEditor }) => {
  const [datasetsToMerge, setDatasetsToMerge] = useState([]);
  const [mergedDataset, setMergedDataset] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);

  // Handle dataset upload for merging
  const handleMergeDataset = async (acceptedFiles) => {
    try {
      if (!acceptedFiles || acceptedFiles.length === 0) {
        alert("No files were selected. Please select valid dataset ZIP files to merge.");
        return;
      }
      
      const validFiles = acceptedFiles.filter(file => file.name.endsWith('.zip'));
      if (validFiles.length === 0) {
        alert("Invalid file types. Please select ZIP files containing your datasets.");
        return;
      }
      
      // Add valid files to the datasetsToMerge array
      setDatasetsToMerge(prev => [...prev, ...validFiles]);
      alert(`${validFiles.length} dataset(s) added successfully!`);
    } catch (error) {
      console.error("Error loading datasets for merge:", error);
      alert("Error loading datasets for merge: " + error.message);
    }
  };

  // Remove a dataset from the merge list
  const removeDatasetFromMerge = (index) => {
    setDatasetsToMerge(prev => prev.filter((_, i) => i !== index));
  };

  // Merge datasets function
  const mergeDatasets = async () => {
    if (datasetsToMerge.length < 2) {
      alert("Please add at least 2 datasets to merge.");
      return;
    }
    
    if (isMerging) return; // Prevent multiple merges
    
    setIsMerging(true);
    setMergeProgress(0);
    
    try {
      // Load all datasets
      const loadedDatasets = [];
      const configs = [];
      
      for (let i = 0; i < datasetsToMerge.length; i++) {
        setMergeProgress(Math.round((i / datasetsToMerge.length) * 50));
        
        const zip = new JSZip();
        const content = await zip.loadAsync(datasetsToMerge[i]);
        loadedDatasets.push(content);
        
        // Load config
        const configFile = content.file("dataset.yaml");
        let config = null;
        if (configFile) {
          const configText = await configFile.async("text");
          config = yaml.load(configText);
        }
        configs.push(config);
      }
      
      // Create a new merged dataset
      const mergedZip = new JSZip();
      
      // Merge dataset.yaml files
      const mergedClasses = new Set();
      const mergedConfig = {
        train: "train/images",
        val: "valid/images"
      };
      
      // Combine classes from all datasets
      configs.forEach((config, index) => {
        setMergeProgress(50 + Math.round((index / configs.length) * 25));
        
        if (config && config.names) {
          config.names.forEach(cls => mergedClasses.add(cls));
        }
      });
      
      // If no classes found, use default
      const finalClasses = mergedClasses.size > 0 ? Array.from(mergedClasses) : ['unknown'];
      mergedConfig.names = finalClasses;
      mergedConfig.nc = finalClasses.length;
      
      const yamlContent = yaml.dump(mergedConfig);
      mergedZip.file("dataset.yaml", yamlContent);
      
      // Merge images and annotations from all datasets
      const splitsToProcess = ['train', 'valid'];
      
      for (let datasetIndex = 0; datasetIndex < loadedDatasets.length; datasetIndex++) {
        setMergeProgress(75 + Math.round((datasetIndex / loadedDatasets.length) * 25));
        
        const content = loadedDatasets[datasetIndex];
        const config = configs[datasetIndex];
        
        for (const split of splitsToProcess) {
          // Process dataset for each split
          let imageBasePath, labelBasePath;
          
          if (split === 'train') {
            imageBasePath = config?.train || "train/images";
            labelBasePath = config?.train?.replace('/images', '/labels') || "train/labels";
          } else if (split === 'valid') {
            imageBasePath = config?.val || "valid/images";
            labelBasePath = config?.val?.replace('/images', '/labels') || "valid/labels";
          }
          
          // Create folder structure in merged dataset
          const splitImageFolder = mergedZip.folder(split).folder("images");
          const splitLabelFolder = mergedZip.folder(split).folder("labels");
          
          // Get image folder from source dataset
          const imageFolder = content.folder(imageBasePath) || content.folder(split) || content.folder("images");
          
          if (imageFolder) {
            const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);
            for (let i = 0; i < imageList.length; i++) {
              const imageFile = imageList[i];
              const imageData = await imageFile.async("uint8array");
              // Rename image to avoid conflicts
              const originalName = imageFile.name.split("/").pop();
              const imageName = `dataset${datasetIndex}_${originalName}`;
              
              // Add image to merged dataset
              splitImageFolder.file(imageName, imageData);
              
              // Add corresponding label file
              const labelFileName = originalName.replace(/\.[^/.]+$/, ".txt");
              const newLabelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
              
              // Try to find label in the same structure as images
              let labelFile = null;
              const imageFolderPath = imageFile.name.split('/').slice(0, -1).join('/');
              if (imageFolderPath) {
                const imageBaseFolder = content.folder(imageFolderPath);
                if (imageBaseFolder) {
                  const labelsFolderPath = imageFolderPath.replace('/images', '/labels');
                  const labelsFolder = content.folder(labelsFolderPath) || content.folder("labels");
                  if (labelsFolder) {
                    labelFile = labelsFolder.file(labelFileName);
                  }
                }
              }
              
              // If not found, try with labelBasePath
              if (!labelFile) {
                const labelFolder = content.folder(labelBasePath) || content.folder("labels");
                if (labelFolder) {
                  labelFile = labelFolder.file(labelFileName);
                }
              }
              
              // If still not found, try in root labels folder
              if (!labelFile) {
                const rootLabelFolder = content.folder("labels");
                if (rootLabelFolder) {
                  labelFile = rootLabelFolder.file(labelFileName);
                }
              }
              
              if (labelFile) {
                const labelContent = await labelFile.async("text");
                // Update class IDs if needed
                const updatedLabelContent = updateClassIdsInLabels(labelContent, config?.names || [], finalClasses);
                splitLabelFolder.file(newLabelFileName, updatedLabelContent);
              }
            }
          }
        }
      }
      
      // Generate the merged zip file
      const content = await mergedZip.generateAsync({ type: "blob" });
      
      // Store merged dataset for download
      setMergedDataset(content);
      
      alert(`Datasets merged successfully! ${datasetsToMerge.length} datasets combined.`);
    } catch (error) {
      console.error("Error merging datasets:", error);
      alert("Error merging datasets: " + error.message);
    } finally {
      setIsMerging(false);
      setMergeProgress(0);
    }
  };

  // Update class IDs in label content based on merged classes
  const updateClassIdsInLabels = (labelContent, originalClasses, mergedClasses) => {
    if (!labelContent.trim() || originalClasses.length === 0) return labelContent;
    
    const lines = labelContent.trim().split('\n');
    const updatedLines = lines.map(line => {
      if (!line.trim()) return line;
      
      const parts = line.trim().split(' ');
      if (parts.length < 5) return line; // Not a valid YOLO annotation
      
      const originalClassId = parseInt(parts[0]);
      if (isNaN(originalClassId) || originalClassId < 0 || originalClassId >= originalClasses.length) {
        return line; // Invalid class ID
      }
      
      // Find the class name in original classes
      const className = originalClasses[originalClassId];
      
      // Find the new class ID in merged classes
      const newClassId = mergedClasses.indexOf(className);
      if (newClassId === -1) return line; // Class not found in merged classes
      
      // Update the class ID
      parts[0] = newClassId.toString();
      return parts.join(' ');
    });
    
    return updatedLines.join('\n');
  };

  // Download merged dataset
  const downloadMergedDataset = async () => {
    if (!mergedDataset) {
      alert("No merged dataset available. Please merge datasets first.");
      return;
    }
    
    try {
      // Create download link
      const url = URL.createObjectURL(mergedDataset);
      const link = document.createElement("a");
      link.href = url;
      link.download = "merged_dataset.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading merged dataset:", error);
      alert("Error downloading merged dataset: " + error.message);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop: handleMergeDataset,
    noClick: false,
    noKeyboard: true
  });

  return (
    <div className="app">
      <div className="header">
        <h1>🔄 Merge Datasets</h1>
        <div className="header-controls">
          <button className="button" onClick={onBackToEditor}>
            ← Back to Editor
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <div className="sidebar">
          <h2>📁 Merge Datasets</h2>
          <p style={{ marginBottom: '1rem', color: '#7f8c8d' }}>
            Combine multiple YOLO format datasets into a single dataset
          </p>
          
          {/* Dataset Merge Section */}
          <div className="form-group">
            <label>Add Datasets to Merge:</label>
            <div 
              {...getRootProps()} 
              className="dropzone"
              style={{ 
                padding: '10px', 
                border: '2px dashed #3498db', 
                borderRadius: '4px', 
                textAlign: 'center', 
                cursor: 'pointer',
                marginBottom: '10px',
                backgroundColor: isDragActive ? '#f0f8ff' : 'transparent'
              }}
            >
              <input {...getInputProps()} />
              <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
                {isDragActive ? (
                  <strong>Drop dataset ZIP files here ...</strong>
                ) : datasetsToMerge.length > 0 ? (
                  `${datasetsToMerge.length} dataset(s) ready to merge`
                ) : (
                  "Drag & drop dataset ZIP files to merge, or click to select"
                )}
              </p>
            </div>
            
            {/* List of datasets to merge */}
            {datasetsToMerge.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: '5px' }}>
                  Datasets to merge:
                </p>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '5px' }}>
                  {datasetsToMerge.map((dataset, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0' }}>
                      <span>{dataset.name}</span>
                      <button 
                        onClick={() => removeDatasetFromMerge(index)}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              className="button"
              onClick={mergeDatasets}
              disabled={datasetsToMerge.length < 2 || isMerging}
              style={{ width: '100%', marginTop: '5px' }}
            >
              {isMerging ? `Merging... ${mergeProgress}%` : `Merge ${datasetsToMerge.length} Datasets`}
            </button>
            
            {/* Download merged dataset button */}
            {mergedDataset && (
              <button 
                className="button"
                onClick={downloadMergedDataset}
                style={{ width: '100%', marginTop: '5px', backgroundColor: '#27ae60' }}
              >
                Download Merged Dataset
              </button>
            )}
          </div>
          
          {isMerging && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ height: '10px', backgroundColor: '#ecf0f1', borderRadius: '5px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    backgroundColor: '#3498db', 
                    width: `${mergeProgress}%`,
                    transition: 'width 0.3s ease'
                  }}
                ></div>
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '5px' }}>
                Merging datasets... {mergeProgress}%
              </p>
            </div>
          )}
        </div>
        
        <div className="canvas-container">
          <div className="merge-content">
            <h2>How to Merge Datasets</h2>
            <div className="instructions">
              <ol>
                <li>Click "Add Datasets to Merge" or drag and drop ZIP files containing YOLO format datasets</li>
                <li>Add at least 2 datasets to merge</li>
                <li>Click "Merge Datasets" to combine them</li>
                <li>Download the merged dataset when complete</li>
              </ol>
              
              <h3>Features:</h3>
              <ul>
                <li>Automatically combines class definitions from all datasets</li>
                <li>Preserves image and annotation data from all datasets</li>
                <li>Renames files to prevent conflicts</li>
                <li>Updates class IDs to match the merged class list</li>
                <li>Shows progress during merging</li>
              </ul>
              
              <div className="info-box">
                <h4>ℹ️ Note</h4>
                <p>
                  The merged dataset will contain all images and annotations from the selected datasets. 
                  Class names will be combined, and annotations will be updated to use the new class IDs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="status-bar">
        <span>Merge Datasets View | {datasetsToMerge.length} datasets selected</span>
      </div>
    </div>
  );
};

export default MergeDatasets;