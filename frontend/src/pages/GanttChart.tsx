import { useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Tooltip,
  Chip
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/staloService';
import type { Project } from '../types';
import { 
  format, 
  eachMonthOfInterval, 
  startOfMonth, 
  endOfMonth, 
  differenceInMonths,
  addMonths,
  min,
  max,
  isSameMonth
} from 'date-fns';

export default function GanttChart() {
  const { data: projectsData, isLoading } = useQuery<Project[], Error>({ 
    queryKey: ['projects'], 
    queryFn: getProjects, 
    staleTime: 1000 * 60 * 5 
  });

  const projects = projectsData ?? [];

  // Calculate date range for all projects
  const dateRange = useMemo(() => {
    if (projects.length === 0) return null;
    
    const allDates = projects.flatMap(p => {
      const dates = [];
      if (p.StartDate) dates.push(new Date(p.StartDate));
      if (p.EndDate) dates.push(new Date(p.EndDate));
      return dates;
    });

    if (allDates.length === 0) return null;

    const minDate = min(allDates);
    const maxDate = max(allDates);
    
    // Start exactly 2 months before current date
    const twoMonthsAgo = addMonths(new Date(), -2);
    const effectiveStart = minDate < twoMonthsAgo ? twoMonthsAgo : minDate;
    
    // Add 2 months padding on the end only
    return {
      start: startOfMonth(effectiveStart),
      end: endOfMonth(addMonths(maxDate, 2))
    };
  }, [projects]);

  // Generate months for the timeline
  const timelineMonths = useMemo(() => {
    if (!dateRange) return [];
    return eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Calculate project position and width
  const getProjectBarStyle = (project: Project) => {
    if (!dateRange || !project.StartDate || !project.EndDate) {
      return { display: 'none' };
    }

    const projectStart = new Date(project.StartDate);
    const projectEnd = new Date(project.EndDate);
    const totalMonths = differenceInMonths(dateRange.end, dateRange.start) + 1;
    
    const startOffset = Math.max(0, differenceInMonths(projectStart, dateRange.start));
    const duration = Math.min(
      differenceInMonths(projectEnd, projectStart) + 1,
      totalMonths - startOffset
    );

    return {
      left: `${(startOffset / totalMonths) * 100}%`,
      width: `${(duration / totalMonths) * 100}%`,
      minWidth: '20px'
    };
  };

  const getProjectColor = (project: Project) => {
    const now = new Date();
    const projectStart = project.StartDate ? new Date(project.StartDate) : null;
    const projectEnd = project.EndDate ? new Date(project.EndDate) : null;
    
    if (!projectStart || !projectEnd) return '#9e9e9e';
    
    if (projectStart > now) return '#2196f3'; // Future - Blue
    if (projectEnd < now) return '#4caf50'; // Completed - Green
    return '#ff9800'; // Active - Orange
  };

  const getProjectStatus = (project: Project) => {
    const now = new Date();
    const projectStart = project.StartDate ? new Date(project.StartDate) : null;
    const projectEnd = project.EndDate ? new Date(project.EndDate) : null;
    
    if (!projectStart || !projectEnd) return 'No Dates';
    if (projectStart > now) return 'Upcoming';
    if (projectEnd < now) return 'Completed';
    return 'Active';
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Loading Gantt Chart...</Typography>
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />}
            onClick={() => window.history.back()}
          >
            Back to Projects
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon />
            Gantt Chart
          </Typography>
        </Box>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No projects found. Create some projects first to see the Gantt chart.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />}
            onClick={() => window.history.back()}
          >
            Back
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon />
            Project Gantt Chart
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label="Active" sx={{ backgroundColor: '#ff9800', color: 'white' }} size="small" />
          <Chip label="Upcoming" sx={{ backgroundColor: '#2196f3', color: 'white' }} size="small" />
          <Chip label="Completed" sx={{ backgroundColor: '#4caf50', color: 'white' }} size="small" />
        </Box>
      </Box>

      {/* Gantt Chart */}
      <Card sx={{ boxShadow: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {/* Timeline Header */}
          <Box sx={{ 
            display: 'flex', 
            backgroundColor: '#f5f5f5', 
            borderBottom: '2px solid #e0e0e0',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <Box sx={{ 
              width: '250px', 
              p: 2, 
              borderRight: '2px solid #e0e0e0',
              backgroundColor: '#fafafa'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Project</Typography>
            </Box>
            <Box sx={{ flex: 1, display: 'flex', minWidth: 0 }}>
              {timelineMonths.map((month, index) => (
                <Box 
                  key={index} 
                  sx={{ 
                    flex: 1, 
                    minWidth: '80px', 
                    p: 1, 
                    borderRight: '1px solid #e0e0e0',
                    textAlign: 'center',
                    backgroundColor: isSameMonth(month, new Date()) ? '#fff3e0' : (index % 2 === 0 ? '#f9f9f9' : '#ffffff'),
                    border: isSameMonth(month, new Date()) ? '2px solid #ff9800' : 'none',
                    borderTop: isSameMonth(month, new Date()) ? '2px solid #ff9800' : 'none'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', color: isSameMonth(month, new Date()) ? '#e65100' : 'inherit' }}>
                    {format(month, 'MMM')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(month, 'yyyy')}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Project Rows */}
          <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {projects.map((project, index) => (
              <Box 
                key={project.ID} 
                sx={{ 
                  display: 'flex', 
                  borderBottom: '1px solid #e0e0e0',
                  '&:hover': { backgroundColor: '#f8f9fa' }
                }}
              >
                {/* Project Info */}
                <Box sx={{ 
                  width: '250px', 
                  p: 1, 
                  borderRight: '2px solid #e0e0e0',
                  backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff'
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {project.Name}
                  </Typography>
                </Box>

                {/* Timeline */}
                <Box sx={{ 
                  flex: 1, 
                  position: 'relative', 
                  minHeight: '40px',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {/* Month grid lines */}
                  {timelineMonths.map((month, monthIndex) => (
                    <Box 
                      key={monthIndex} 
                      sx={{ 
                        flex: 1, 
                        borderRight: '1px solid #f0f0f0',
                        minHeight: '100%',
                        backgroundColor: isSameMonth(month, new Date()) ? 'rgba(255, 152, 0, 0.05)' : 'transparent'
                      }} 
                    />
                  ))}
                  
                  {/* Project Bar */}
                  <Tooltip 
                    title={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {project.Name}
                        </Typography>
                        <Typography variant="caption">
                          {project.StartDate && `Start: ${format(new Date(project.StartDate), 'MMM dd, yyyy')}`}
                        </Typography>
                        <br />
                        <Typography variant="caption">
                          {project.EndDate && `End: ${format(new Date(project.EndDate), 'MMM dd, yyyy')}`}
                        </Typography>
                        <br />
                        <Typography variant="caption">
                          Status: {getProjectStatus(project)}
                        </Typography>
                        {project.ProjectBudget && (
                          <>
                            <br />
                            <Typography variant="caption">
                              Budget: {project.ProjectCurrency || 'USD'} {project.ProjectBudget.toLocaleString()}
                            </Typography>
                          </>
                        )}
                      </Box>
                    }
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        height: '20px',
                        borderRadius: '10px',
                        backgroundColor: getProjectColor(project),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'scaleY(1.2)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        },
                        ...getProjectBarStyle(project)
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'white', 
                          fontSize: '0.6rem', 
                          fontWeight: 'bold',
                          px: 0.5,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}
                      >
                        {project.Name}
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
