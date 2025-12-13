import { useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/staloService';
import type { Project } from '../types';
import { 
  parse,
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  isBefore,
  isAfter
} from 'date-fns';

interface GanttChartProps {
  selectedDate: Date;
}

export default function GanttChart({ selectedDate }: GanttChartProps) {
  const { data: projectsData, isLoading, error } = useQuery<Project[], Error>({ 
    queryKey: ['projects'], 
    queryFn: getProjects, 
    staleTime: 1000 * 60 * 5 
  });

  const projects = projectsData ?? [];

  // Generate 18 months starting from selectedDate
  const months = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => addMonths(startOfMonth(selectedDate), i));
  }, [selectedDate]);

  // Parse date helper
  const parseProjectDate = (d?: string | null): Date | null => {
    if (!d) return null;
    if (d.includes('T') || d.includes('Z') || d.match(/\+\d{2}:?\d{2}/)) {
      return new Date(d);
    }
    try {
      return parse(d, 'yyyy-MM-dd', new Date());
    } catch {
      return new Date(d);
    }
  };

  // Get project status based on today's date
  const getProjectStatus = (start: Date | null, end: Date | null): 'active' | 'upcoming' | 'completed' | 'unknown' => {
    if (!start || !end) return 'unknown';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startNorm = new Date(start);
    startNorm.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);
    
    if (endNorm < today) {
      return 'completed';
    } else if (startNorm > today) {
      return 'upcoming';
    } else {
      return 'active';
    }
  };

  // Get project status color based on today's date
  const getProjectColor = (start: Date | null, end: Date | null) => {
    const status = getProjectStatus(start, end);
    switch (status) {
      case 'completed': return '#616161'; // dark grey
      case 'upcoming': return '#2196f3'; // blue
      case 'active': return '#4caf50'; // green
      default: return '#9e9e9e';
    }
  };

  // Group projects by status
  const groupedProjects = useMemo(() => {
    const active: Project[] = [];
    const upcoming: Project[] = [];
    const completed: Project[] = [];
    
    projects.forEach(project => {
      const start = parseProjectDate(project.StartDate);
      const end = parseProjectDate(project.EndDate);
      const status = getProjectStatus(start, end);
      
      switch (status) {
        case 'active': active.push(project); break;
        case 'upcoming': upcoming.push(project); break;
        case 'completed': completed.push(project); break;
        default: completed.push(project); // Put unknown in completed
      }
    });
    
    return { active, upcoming, completed };
  }, [projects]);

  // Check if project spans a specific month
  const isProjectInMonth = (project: Project, month: Date): boolean => {
    const start = parseProjectDate(project.StartDate);
    const end = parseProjectDate(project.EndDate);
    
    if (!start || !end) return false;
    
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    // Project is in this month if it overlaps with the month range
    return !(isAfter(start, monthEnd) || isBefore(end, monthStart));
  };

  // Get bar style for a project in a month - fills entire cell for connected look
  const getBarStyle = (project: Project, month: Date): React.CSSProperties | null => {
    const start = parseProjectDate(project.StartDate);
    const end = parseProjectDate(project.EndDate);
    
    if (!start || !end) return null;
    if (!isProjectInMonth(project, month)) return null;
    
    const color = getProjectColor(start, end);
    
    return {
      backgroundColor: color,
      height: '100%',
      minHeight: '20px',
      borderRadius: '0',
      width: '100%'
    };
  };

  if (error) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography color="error">Error loading projects: {error.message}</Typography>
      </Box>
    );
  }

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
            Back
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
    <Box sx={{ p: 2, backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            variant="outlined" 
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => window.history.back()}
          >
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon />
            Project Gantt Chart
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label="Active" sx={{ backgroundColor: '#4caf50', color: 'white' }} size="small" />
          <Chip label="Upcoming" sx={{ backgroundColor: '#2196f3', color: 'white' }} size="small" />
          <Chip label="Completed" sx={{ backgroundColor: '#616161', color: 'white' }} size="small" />
        </Box>
      </Box>

      {/* Gantt Chart Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell 
                sx={{ 
                  width: '280px', 
                  fontWeight: 'bold', 
                  borderRight: '2px solid #e0e0e0',
                  py: 0.75,
                  fontSize: '0.8rem'
                }}
              >
                Project Name
              </TableCell>
              {months.map((month, index) => (
                <TableCell 
                  key={index} 
                  align="center" 
                  sx={{ 
                    fontWeight: 'bold',
                    borderRight: '1px solid #e0e0e0',
                    py: 0.5,
                    px: 0.5,
                    fontSize: '0.7rem',
                    minWidth: '55px'
                  }}
                >
                  <Box>{format(month, 'MMM')}</Box>
                  <Box sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{format(month, 'yyyy')}</Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Active Projects */}
            {groupedProjects.active.length > 0 && (
              <>
                <TableRow>
                  <TableCell 
                    colSpan={months.length + 1} 
                    sx={{ 
                      backgroundColor: '#e8f5e9', 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      py: 0.5,
                      color: '#2e7d32'
                    }}
                  >
                    Active ({groupedProjects.active.length})
                  </TableCell>
                </TableRow>
                {groupedProjects.active.map((project) => {
                  const start = parseProjectDate(project.StartDate);
                  const end = parseProjectDate(project.EndDate);
                  
                  return (
                    <TableRow 
                      key={project.ID}
                      sx={{ 
                        '&:hover': { backgroundColor: '#f8f9fa' },
                        '& td': { py: 0.25 }
                      }}
                    >
                      <TableCell 
                        sx={{ 
                          borderRight: '2px solid #e0e0e0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          py: 0.5
                        }}
                      >
                        <Tooltip title={`${project.Name} (${start ? format(start, 'MMM dd, yyyy') : 'N/A'} - ${end ? format(end, 'MMM dd, yyyy') : 'N/A'})`}>
                          <Box>
                            <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                              {project.Name}
                            </Typography>
                            <Typography component="span" sx={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'text.secondary', ml: 0.5 }}>
                              ({start ? format(start, 'MMM yy') : '?'} - {end ? format(end, 'MMM yy') : '?'})
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      {months.map((month, index) => {
                        const barStyle = getBarStyle(project, month);
                        
                        return (
                          <TableCell 
                            key={index} 
                            align="center"
                            sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              p: 0,
                              height: '24px'
                            }}
                          >
                            {barStyle && (
                              <Tooltip title={`${project.Name}: ${start ? format(start, 'MMM dd, yyyy') : 'N/A'} - ${end ? format(end, 'MMM dd, yyyy') : 'N/A'}`}>
                                <Box sx={barStyle} />
                              </Tooltip>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </>
            )}

            {/* Upcoming Projects */}
            {groupedProjects.upcoming.length > 0 && (
              <>
                <TableRow>
                  <TableCell 
                    colSpan={months.length + 1} 
                    sx={{ 
                      backgroundColor: '#e3f2fd', 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      py: 0.5,
                      color: '#1565c0'
                    }}
                  >
                    Upcoming ({groupedProjects.upcoming.length})
                  </TableCell>
                </TableRow>
                {groupedProjects.upcoming.map((project) => {
                  const start = parseProjectDate(project.StartDate);
                  const end = parseProjectDate(project.EndDate);
                  
                  return (
                    <TableRow 
                      key={project.ID}
                      sx={{ 
                        '&:hover': { backgroundColor: '#f8f9fa' },
                        '& td': { py: 0.25 }
                      }}
                    >
                      <TableCell 
                        sx={{ 
                          borderRight: '2px solid #e0e0e0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          py: 0.5
                        }}
                      >
                        <Tooltip title={`${project.Name} (${start ? format(start, 'MMM dd, yyyy') : 'N/A'} - ${end ? format(end, 'MMM dd, yyyy') : 'N/A'})`}>
                          <Box>
                            <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                              {project.Name}
                            </Typography>
                            <Typography component="span" sx={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'text.secondary', ml: 0.5 }}>
                              ({start ? format(start, 'MMM yy') : '?'} - {end ? format(end, 'MMM yy') : '?'})
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      {months.map((month, index) => {
                        const barStyle = getBarStyle(project, month);
                        
                        return (
                          <TableCell 
                            key={index} 
                            align="center"
                            sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              p: 0,
                              height: '24px'
                            }}
                          >
                            {barStyle && (
                              <Tooltip title={`${project.Name}: ${start ? format(start, 'MMM dd, yyyy') : 'N/A'} - ${end ? format(end, 'MMM dd, yyyy') : 'N/A'}`}>
                                <Box sx={barStyle} />
                              </Tooltip>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </>
            )}

            {/* Completed Projects */}
            {groupedProjects.completed.length > 0 && (
              <>
                <TableRow>
                  <TableCell 
                    colSpan={months.length + 1} 
                    sx={{ 
                      backgroundColor: '#f5f5f5', 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      py: 0.5,
                      color: '#616161'
                    }}
                  >
                    Completed ({groupedProjects.completed.length})
                  </TableCell>
                </TableRow>
                {groupedProjects.completed.map((project) => {
                  const start = parseProjectDate(project.StartDate);
                  const end = parseProjectDate(project.EndDate);
                  
                  return (
                    <TableRow 
                      key={project.ID}
                      sx={{ 
                        '&:hover': { backgroundColor: '#f8f9fa' },
                        '& td': { py: 0.25 }
                      }}
                    >
                      <TableCell 
                        sx={{ 
                          borderRight: '2px solid #e0e0e0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          py: 0.5
                        }}
                      >
                        <Tooltip title={`${project.Name} (${start ? format(start, 'MMM dd, yyyy') : 'N/A'} - ${end ? format(end, 'MMM dd, yyyy') : 'N/A'})`}>
                          <Box>
                            <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                              {project.Name}
                            </Typography>
                            <Typography component="span" sx={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'text.secondary', ml: 0.5 }}>
                              ({start ? format(start, 'MMM yy') : '?'} - {end ? format(end, 'MMM yy') : '?'})
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      {months.map((month, index) => {
                        const barStyle = getBarStyle(project, month);
                        
                        return (
                          <TableCell 
                            key={index} 
                            align="center"
                            sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              p: 0,
                              height: '24px'
                            }}
                          >
                            {barStyle && (
                              <Tooltip title={`${project.Name}: ${start ? format(start, 'MMM dd, yyyy') : 'N/A'} - ${end ? format(end, 'MMM dd, yyyy') : 'N/A'}`}>
                                <Box sx={barStyle} />
                              </Tooltip>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
