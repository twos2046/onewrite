import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Camera, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BRAND_TAGLINE, WORKFLOW_STEPS } from '@/config/brand';

const stepIcons = {
  story: BookOpen,
  visual: ImageIcon,
  script: FileText,
  prep: Camera,
  filming: Film,
} as const;

const WorkflowRoadmap: React.FC = () => {
  return (
    <Card className="mx-auto mb-10 bg-white/90 backdrop-blur-sm shadow-xl border-[#F2E6E1] kawaii-card relative overflow-hidden">
      <CardHeader>
        <CardTitle className="text-xl text-[#FF5724] flex items-center gap-2">
          {BRAND_TAGLINE}
          <Badge variant="secondary" className="bg-[#FBF5F3] text-[#FF5724]">
            5步成剧
          </Badge>
        </CardTitle>
        <CardDescription>把灵感快速变成可发布的漫剧作品</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = stepIcons[step.id as keyof typeof stepIcons] || BookOpen;
            return (
              <div
                key={step.id}
                className="group rounded-xl border border-[#FFE8E0] bg-white/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-[#FF5724] text-[#FF5724]">
                    STEP {index + 1}
                  </Badge>
                  <Icon className="h-5 w-5 text-[#FF7A4D]" />
                </div>
                <div className="mt-3 text-base font-semibold text-gray-800">{step.title}</div>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">{step.description}</p>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full border-[#FF5724] text-[#FF5724] hover:bg-[#FF5724] hover:text-white"
                >
                  <Link to={step.path} className="flex items-center justify-center gap-1">
                    进入
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowRoadmap;
