import { ProjectDomainPanel } from "@/features/domains/ProjectDomainPanel";

type Props = {
  params: { locale: string; id: string };
};

export default function ProjectDomainsPage({ params }: Props) {
  const { id: projectId } = params;

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Domains & Hosting</h1>
      <ProjectDomainPanel projectId={projectId} />
    </div>
  );
}
