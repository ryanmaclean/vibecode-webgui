import { useDropzone } from 'react-dropzone';

const MyDropzone = () => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: acceptedFiles => {
      console.log(acceptedFiles);
    }
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {
        isDragActive ? <p>Drop the files here ...</p> : <p>Drag and drop or click to upload files</p>
      }
    </div>
  );
};