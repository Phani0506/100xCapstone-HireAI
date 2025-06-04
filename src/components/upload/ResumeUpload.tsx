import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle, Loader, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const ResumeUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: string;
    name: string;
    status: 'uploading' | 'parsing' | 'completed' | 'failed';
  }>>([]);
  const [existingResumes, setExistingResumes] = useState<Array<{
    id: string;
    file_name: string;
    parsing_status: string;
    created_at: string;
  }>>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchExistingResumes();
    }
  }, [user]);

  const fetchExistingResumes = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('resumes')
      .select('id, file_name, parsing_status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching resumes:', error);
    } else {
      setExistingResumes(data || []);
    }
  };

  const handleDeleteResume = async (resumeId: string, fileName: string) => {
    if (!user) return;
    
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId)
        .eq('user_id', user.id);
      
      if (dbError) throw dbError;
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .remove([`${user.id}/${resumeId}`]);
      
      if (storageError) {
        console.warn('Storage deletion failed:', storageError);
      }
      
      // Update UI
      setExistingResumes(prev => prev.filter(r => r.id !== resumeId));
      toast({
        title: "Success",
        description: `${fileName} deleted successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!user) return;
    
    setUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        // Check file type
        if (!file.type.includes('pdf') && !file.type.includes('doc')) {
          toast({
            title: "Invalid file type",
            description: "Please upload PDF or DOC files only",
            variant: "destructive",
          });
          continue;
        }

        // Add to uploaded files list
        const tempId = Date.now().toString();
        setUploadedFiles(prev => [...prev, {
          id: tempId,
          name: file.name,
          status: 'uploading'
        }]);

        // Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save resume record to database
        const { data: resumeData, error: dbError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            mime_type: file.type,
            parsing_status: 'processing'
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Update status to parsing
        setUploadedFiles(prev => prev.map(f => 
          f.id === tempId ? { ...f, id: resumeData.id, status: 'parsing' } : f
        ));

        // Trigger AI parsing
        const { error: parseError } = await supabase.functions.invoke('parse-resume', {
          body: { 
            resumeId: resumeData.id, 
            filePath: fileName 
          }
        });

        if (parseError) {
          console.error('Parse error:', parseError);
          setUploadedFiles(prev => prev.map(f => 
            f.id === resumeData.id ? { ...f, status: 'failed' } : f
          ));
          toast({
            title: "Parsing failed",
            description: "Resume uploaded but AI parsing failed",
            variant: "destructive",
          });
        } else {
          setUploadedFiles(prev => prev.map(f => 
            f.id === resumeData.id ? { ...f, status: 'completed' } : f
          ));
          toast({
            title: "Success",
            description: `${file.name} uploaded and parsed successfully`,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Refresh existing resumes list
      fetchExistingResumes();
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
      case 'parsing':
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'parsing':
        return 'AI Parsing...';
      case 'completed':
        return 'Ready';
      case 'failed':
        return 'Failed';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Upload Resumes</h2>
        <p className="text-gray-600">Upload candidate resumes to build your talent pool</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resume Upload</CardTitle>
          <CardDescription>
            Upload PDF or DOC files. Our AI will automatically parse and extract candidate information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drag and drop resume files here
            </h3>
            <p className="text-gray-600 mb-4">or click to browse</p>
            
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            
            <Button asChild disabled={uploading}>
              <label htmlFor="file-upload" className="cursor-pointer">
                {uploading ? 'Processing...' : 'Choose Files'}
              </label>
            </Button>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Upload Progress</h4>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{file.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(file.status)}
                      <span className="text-sm text-gray-600">{getStatusText(file.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingResumes.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Uploaded Resumes</h4>
              <div className="space-y-2">
                {existingResumes.map((resume) => (
                  <div key={resume.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <span className="text-sm text-gray-900">{resume.file_name}</span>
                        <p className="text-xs text-gray-500">
                          {new Date(resume.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        resume.parsing_status === 'completed' ? 'bg-green-100 text-green-700' :
                        resume.parsing_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {resume.parsing_status || 'pending'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteResume(resume.id, resume.file_name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-start space-x-2 text-sm text-gray-600">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
            <div>
              <p>Supported formats: PDF, DOC, DOCX</p>
              <p>Maximum file size: 10MB per file</p>
              <p>AI parsing will begin automatically after upload</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
