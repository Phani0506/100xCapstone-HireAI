
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const ResumeUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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

        // Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save resume record to database
        const { error: dbError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            mime_type: file.type,
          });

        if (dbError) throw dbError;

        toast({
          title: "Success",
          description: `${file.name} uploaded successfully`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
                {uploading ? 'Uploading...' : 'Choose Files'}
              </label>
            </Button>
          </div>

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
